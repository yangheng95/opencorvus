// This source executes inside the per-Task Linux namespace. Every traversal is
// anchored to an open directory handle, so a concurrent rename or symlink swap
// cannot redirect the eventual operation after authority has been checked.
export const EXECUTION_CAPSULE_FILE_WORKER_SOURCE = String.raw`
const fs = require("node:fs/promises");
const constants = require("node:fs").constants;
const path = require("node:path");

function capsuleError(label, value, cause) {
  return Object.assign(new Error(label + " path " + value + " is outside exact Capsule root"), {
    code: "EACCES",
    path: value,
    syscall: "capsule_path",
    cause,
  });
}

function relativeParts(root, value, label) {
  if (typeof value !== "string" || value.length === 0) throw Object.assign(new Error(label + " path is invalid"), { code: "EINVAL" });
  const lexical = path.resolve(value);
  const relative = path.relative(root, lexical);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw capsuleError(label, lexical);
  }
  return { lexical, parts: relative === "" ? [] : relative.split(path.sep) };
}

function fdPath(handle, name) {
  return name === undefined ? "/proc/self/fd/" + handle.fd : "/proc/self/fd/" + handle.fd + "/" + name;
}

async function openDirectoryAt(parent, name, label, lexical) {
  try {
    return await fs.open(fdPath(parent, name), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  } catch (cause) {
    if (cause && (cause.code === "ELOOP" || cause.code === "ENOTDIR")) throw capsuleError(label, lexical, cause);
    throw cause;
  }
}

async function openRoot(root) {
  return fs.open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
}

async function openParent(root, value, label, createParents) {
  const target = relativeParts(root, value, label);
  if (target.parts.length === 0) return { target, parent: await openRoot(root), name: "" };
  let current = await openRoot(root);
  try {
    for (const part of target.parts.slice(0, -1)) {
      let next;
      try {
        next = await openDirectoryAt(current, part, label, target.lexical);
      } catch (cause) {
        if (!createParents || !cause || cause.code !== "ENOENT") throw cause;
        await fs.mkdir(fdPath(current, part));
        next = await openDirectoryAt(current, part, label, target.lexical);
      }
      await current.close();
      current = next;
    }
    return { target, parent: current, name: target.parts[target.parts.length - 1] };
  } catch (cause) {
    await current.close().catch(() => undefined);
    throw cause;
  }
}

async function openTarget(root, value, label, flags = constants.O_RDONLY) {
  const anchored = await openParent(root, value, label, false);
  if (anchored.name === "") return { ...anchored, handle: anchored.parent, shared: true };
  try {
    const handle = await fs.open(fdPath(anchored.parent, anchored.name), flags | constants.O_NOFOLLOW);
    return { ...anchored, handle, shared: false };
  } catch (cause) {
    await anchored.parent.close().catch(() => undefined);
    if (cause && (cause.code === "ELOOP" || cause.code === "ENOTDIR")) throw capsuleError(label, anchored.target.lexical, cause);
    throw cause;
  }
}

async function closeTarget(target) {
  if (!target.shared) await target.handle.close();
  await target.parent.close();
}

function decode(value) {
  if (value && typeof value === "object" && typeof value.__bytes === "string") return Buffer.from(value.__bytes, "base64");
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
  return value;
}

function fileType(value) {
  return {
    isBlockDevice: value.isBlockDevice(), isCharacterDevice: value.isCharacterDevice(), isDirectory: value.isDirectory(),
    isFIFO: value.isFIFO(), isFile: value.isFile(), isSocket: value.isSocket(), isSymbolicLink: value.isSymbolicLink(),
  };
}

function encode(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __bytes: Buffer.from(value).toString("base64") };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object" && typeof value.isFile === "function") {
    const type = fileType(value);
    if (typeof value.name === "string") return { __dirent: true, name: value.name, parentPath: value.parentPath, ...type };
    const fields = {};
    for (const key of ["dev", "ino", "mode", "nlink", "uid", "gid", "rdev", "size", "blksize", "blocks", "atimeMs", "mtimeMs", "ctimeMs", "birthtimeMs"]) {
      const item = value[key];
      if (typeof item === "number" || typeof item === "bigint") fields[key] = typeof item === "bigint" ? { __bigint: String(item) } : item;
    }
    return { __stats: true, ...fields, ...type };
  }
  return value;
}

const writeFlags = Object.freeze({
  w: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC,
  wx: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_EXCL,
  a: constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND,
  ax: constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_EXCL,
  "r+": constants.O_RDWR,
  "w+": constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC,
  "wx+": constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC | constants.O_EXCL,
  "a+": constants.O_RDWR | constants.O_CREAT | constants.O_APPEND,
  "ax+": constants.O_RDWR | constants.O_CREAT | constants.O_APPEND | constants.O_EXCL,
});

async function copyAnchoredFile(source, destination, options) {
  const exclusive = Boolean(options && options.errorOnExist && !options.force);
  let target;
  try {
    target = await fs.open(
      fdPath(destination.parent, destination.name),
      constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW | (exclusive ? constants.O_EXCL : 0),
    );
  } catch (cause) {
    if (cause && cause.code === "ELOOP") throw capsuleError("cp", destination.lexical, cause);
    throw cause;
  }
  try { await fs.copyFile(fdPath(source), fdPath(target)); }
  finally { await target.close(); }
}

async function copyAnchoredTree(source, destination, options, logicalDestination) {
  const entries = await fs.readdir(fdPath(source), { withFileTypes: true });
  for (const entry of entries) {
    const sourceEntry = fdPath(source, entry.name);
    const destinationEntry = { parent: destination, name: entry.name, lexical: path.join(logicalDestination, entry.name) };
    if (entry.isSymbolicLink()) throw capsuleError("cp", sourceEntry);
    if (entry.isDirectory()) {
      const sourceChild = await openDirectoryAt(source, entry.name, "cp", sourceEntry);
      try {
        try { await fs.mkdir(fdPath(destination, entry.name)); }
        catch (cause) { if (!cause || cause.code !== "EEXIST") throw cause; }
        const destinationChild = await openDirectoryAt(destination, entry.name, "cp", destinationEntry.lexical);
        try { await copyAnchoredTree(sourceChild, destinationChild, options, destinationEntry.lexical); }
        finally { await destinationChild.close(); }
      } finally { await sourceChild.close(); }
      continue;
    }
    if (!entry.isFile()) throw Object.assign(new Error("cp supports regular files and directories"), { code: "ENOSYS" });
    const sourceChild = await fs.open(sourceEntry, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { await copyAnchoredFile(sourceChild, destinationEntry, options); }
    finally { await sourceChild.close(); }
  }
}

async function operation(root, name, args) {
  if (name === "readFile") {
    const target = await openTarget(root, args[0], name);
    try { return await target.handle.readFile(args[1]); } finally { await closeTarget(target); }
  }
  if (name === "writeFile") {
    const option = args[2];
    const flag = typeof option === "object" && option ? option.flag || "w" : "w";
    if (!(flag in writeFlags)) throw Object.assign(new Error("Unsupported anchored write flag " + flag), { code: "ENOSYS" });
    const target = await openTarget(root, args[0], name, writeFlags[flag]);
    try { return await target.handle.writeFile(args[1], option); } finally { await closeTarget(target); }
  }
  if (name === "stat") {
    const target = await openTarget(root, args[0], name);
    try { return await target.handle.stat(args[1]); } finally { await closeTarget(target); }
  }
  if (name === "lstat") {
    const target = await openParent(root, args[0], name, false);
    try { return await fs.lstat(target.name === "" ? fdPath(target.parent) : fdPath(target.parent, target.name), args[1]); }
    finally { await target.parent.close(); }
  }
  if (name === "access") {
    const target = await openTarget(root, args[0], name);
    try { return await fs.access(fdPath(target.handle), args[1]); } finally { await closeTarget(target); }
  }
  if (name === "realpath") {
    const target = await openTarget(root, args[0], name);
    try { return args[1] === "buffer" || (args[1] && args[1].encoding === "buffer") ? Buffer.from(target.target.lexical) : target.target.lexical; }
    finally { await closeTarget(target); }
  }
  if (name === "readdir") {
    const target = await openTarget(root, args[0], name, constants.O_RDONLY | constants.O_DIRECTORY);
    try { return await fs.readdir(fdPath(target.handle), args[1]); } finally { await closeTarget(target); }
  }
  if (name === "mkdir") {
    const recursive = Boolean(args[1] && args[1].recursive);
    const target = relativeParts(root, args[0], name);
    if (target.parts.length === 0) return recursive ? undefined : fs.mkdir(root, args[1]);
    let current = await openRoot(root);
    let firstCreated;
    try {
      for (const [index, part] of target.parts.entries()) {
        let next;
        try { next = await openDirectoryAt(current, part, name, target.lexical); }
        catch (cause) {
          if (!cause || cause.code !== "ENOENT" || (!recursive && index !== target.parts.length - 1)) throw cause;
          await fs.mkdir(fdPath(current, part), args[1] && { ...args[1], recursive: false });
          if (firstCreated === undefined) firstCreated = path.join(root, ...target.parts.slice(0, index + 1));
          next = await openDirectoryAt(current, part, name, target.lexical);
        }
        await current.close();
        current = next;
      }
      return recursive ? firstCreated : undefined;
    } finally { await current.close().catch(() => undefined); }
  }
  if (name === "mkdtemp") {
    const target = await openParent(root, args[0], name, false);
    try { return await fs.mkdtemp(fdPath(target.parent, target.name), args[1]); } finally { await target.parent.close(); }
  }
  if (name === "copyFile") {
    const source = await openTarget(root, args[0], name);
    const exclusive = Boolean((args[2] || 0) & constants.COPYFILE_EXCL);
    const destination = await openTarget(
      root,
      args[1],
      name,
      constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (exclusive ? constants.O_EXCL : 0),
    );
    try { return await fs.copyFile(fdPath(source.handle), fdPath(destination.handle)); }
    finally { await closeTarget(source); await closeTarget(destination); }
  }
  if (name === "cp") {
    const source = await openTarget(root, args[0], name);
    const sourceInfo = await source.handle.stat();
    let destination;
    if (sourceInfo.isDirectory()) {
      const anchored = await openParent(root, args[1], name, false);
      try {
        try { await fs.mkdir(fdPath(anchored.parent, anchored.name)); }
        catch (cause) { if (!cause || cause.code !== "EEXIST") throw cause; }
      } finally { await anchored.parent.close(); }
      destination = await openTarget(root, args[1], name, constants.O_RDONLY | constants.O_DIRECTORY);
    } else {
      const options = args[2] || {};
      destination = await openTarget(
        root,
        args[1],
        name,
        constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (options.errorOnExist && !options.force ? constants.O_EXCL : 0),
      );
    }
    try {
      if (sourceInfo.isDirectory()) {
        if (!args[2] || args[2].recursive !== true) throw Object.assign(new Error("cp directory requires recursive=true"), { code: "EISDIR" });
        return await copyAnchoredTree(source.handle, destination.handle, args[2], destination.target.lexical);
      }
      return await fs.copyFile(fdPath(source.handle), fdPath(destination.handle));
    }
    finally { await closeTarget(source); await closeTarget(destination); }
  }
  if (name === "rename") {
    const source = await openParent(root, args[0], name, false);
    const destination = await openParent(root, args[1], name, false);
    try { return await fs.rename(fdPath(source.parent, source.name), fdPath(destination.parent, destination.name)); }
    finally { await source.parent.close(); await destination.parent.close(); }
  }
  if (name === "rm") {
    const target = await openParent(root, args[0], name, false);
    try {
      if (target.name === "") throw Object.assign(new Error("Capsule root cannot be removed"), { code: "EACCES", path: args[0], syscall: "rm" });
      return await fs.rm(fdPath(target.parent, target.name), args[1]);
    } finally { await target.parent.close(); }
  }
  throw Object.assign(new Error("Unsupported file operation"), { code: "ENOSYS" });
}

async function main() {
  const root = path.resolve(await fs.realpath(process.argv[1]));
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const value = await operation(root, request.operation, decode(request.args));
  process.stdout.write(JSON.stringify({ ok: true, value: encode(value) }));
}

main().catch((error) => {
  process.stdout.write(JSON.stringify({ ok: false, error: {
    name: error && error.name, message: error && error.message ? error.message : String(error),
    code: error && error.code, path: error && error.path, syscall: error && error.syscall,
  }}));
  process.exitCode = 1;
});
`
