$ErrorActionPreference='Stop'
$taskRun='C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-22/live-task-source-growth-537-after'
$taskReady=Get-Content -Raw -LiteralPath "$taskRun/evidence/native-host-ready.json"|ConvertFrom-Json
. 'D:/myhexin-local/opencorvus/.tmp-product-iteration/live-sol-long-source-reading-406-launch.ps1' -FunctionsOnly
if((Get-OwnedNativeState $taskReady.target) -cne 'exact_live'){throw 'Original exact owned process required'}
$taskSymbols=Join-Path $PSScriptRoot 'bun-windows-x64-profile'
if(!(Test-Path -LiteralPath (Join-Path $taskSymbols 'bun-profile.pdb'))){throw 'Exact official PDB required;PE CodeView signature and age verified separately'}
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class OwnedStack537 {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint id);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenThread(uint access,bool inherit,uint id);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint SuspendThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetThreadContext(IntPtr thread,IntPtr context);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("dbghelp.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool SymInitializeW(IntPtr process,string path,bool invade);
 [DllImport("dbghelp.dll")] static extern bool SymCleanup(IntPtr process);
 [DllImport("dbghelp.dll")] static extern uint SymSetOptions(uint options);
 [DllImport("dbghelp.dll")] static extern IntPtr SymFunctionTableAccess64(IntPtr process,ulong address);
 [DllImport("dbghelp.dll")] static extern ulong SymGetModuleBase64(IntPtr process,ulong address);
 [DllImport("dbghelp.dll",CharSet=CharSet.Ansi)] static extern bool SymFromAddr(IntPtr process,ulong address,out ulong displacement,IntPtr symbol);
 delegate IntPtr FunctionTable(IntPtr process,ulong address);
 delegate ulong ModuleBase(IntPtr process,ulong address);
 [DllImport("dbghelp.dll")] static extern bool StackWalk64(uint machine,IntPtr process,IntPtr thread,IntPtr frame,IntPtr context,IntPtr read,FunctionTable functionTable,ModuleBase moduleBase,IntPtr translate);
 public sealed class Frame { public string module; public string offset; public string symbol; public ulong displacement; }
 public sealed class Trace { public int thread; public List<Frame> frames=new List<Frame>(); public string error; public uint priorSuspendCount; }
 static IntPtr Zero(int bytes) {var p=Marshal.AllocHGlobal(bytes);Marshal.Copy(new byte[bytes],0,p,bytes);return p;}
 public static Trace[] Capture(int pid,string symbols) {
  var process=Process.GetProcessById(pid);var modules=new List<ProcessModule>();foreach(ProcessModule m in process.Modules)modules.Add(m);
  var handle=OpenProcess(0x410,false,(uint)pid);if(handle==IntPtr.Zero)throw new Win32Exception();
  bool initialized=false;var result=new List<Trace>();
  try {
   SymSetOptions(0x80000|0x200|0x4|0x2|0x1000);
   if(!SymInitializeW(handle,symbols,true))throw new Win32Exception();initialized=true;
   FunctionTable ft=SymFunctionTableAccess64;ModuleBase mb=SymGetModuleBase64;
   foreach(ProcessThread t in process.Threads) {
    var trace=new Trace{thread=t.Id};result.Add(trace);
    var th=OpenThread(0x004A,false,(uint)t.Id);if(th==IntPtr.Zero){trace.error="OpenThread:"+Marshal.GetLastWin32Error();continue;}
    var raw=Zero(1250);var context=new IntPtr((raw.ToInt64()+15)&~15L);var frame=Zero(4096);
    try {
     Marshal.WriteInt32(context,48,0x100003);
     var prior=SuspendThread(th);trace.priorSuspendCount=prior;if(prior==uint.MaxValue)throw new Win32Exception();
     try {if(!GetThreadContext(th,context))throw new Win32Exception();}
     finally {if(ResumeThread(th)==uint.MaxValue)throw new Win32Exception();}
     Marshal.WriteInt64(frame,0,Marshal.ReadInt64(context,248));Marshal.WriteInt32(frame,12,3);
     Marshal.WriteInt64(frame,32,Marshal.ReadInt64(context,160));Marshal.WriteInt32(frame,44,3);
     Marshal.WriteInt64(frame,48,Marshal.ReadInt64(context,152));Marshal.WriteInt32(frame,60,3);
     for(int i=0;i<64;i++) {
      if(!StackWalk64(0x8664,handle,th,frame,context,IntPtr.Zero,ft,mb,IntPtr.Zero))break;
      ulong address=(ulong)Marshal.ReadInt64(frame,0);if(address==0)break;
      var f=new Frame();foreach(var m in modules){ulong start=(ulong)m.BaseAddress.ToInt64();if(address>=start&&address<start+(ulong)m.ModuleMemorySize){f.module=m.ModuleName;f.offset="0x"+(address-start).ToString("X");break;}}
      var symbol=Zero(88+1024);try{Marshal.WriteInt32(symbol,0,88);Marshal.WriteInt32(symbol,80,1024);ulong d;if(SymFromAddr(handle,address,out d,symbol)){f.symbol=Marshal.PtrToStringAnsi(IntPtr.Add(symbol,84));f.displacement=d;}}finally{Marshal.FreeHGlobal(symbol);}
      trace.frames.Add(f);
     }
    }catch(Exception e){trace.error=e.GetType().Name+":"+e.Message;}
    finally {Marshal.FreeHGlobal(frame);Marshal.FreeHGlobal(raw);CloseHandle(th);}
   }
   GC.KeepAlive(ft);GC.KeepAlive(mb);return result.ToArray();
  }finally{if(initialized)SymCleanup(handle);CloseHandle(handle);}
 }
}
'@
$taskStacks=[OwnedStack537]::Capture($taskReady.target.pid,$taskSymbols)
$taskResult=@{at=[DateTime]::UtcNow.ToString('o');owner=$taskReady.target;method='Own process only;brief balanced suspension for context;resume before StackWalk64;code modules/offsets/symbols only;no arguments or memory dump';stacks=$taskStacks}
$taskResult|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $PSScriptRoot ('after-native-stacks-'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+'.json'))
$taskResult|ConvertTo-Json -Depth 12
