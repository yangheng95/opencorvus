Own the supplied policy, schedule, declaration, endorsement, and fact-trace branch. Apply `insurance-claims-operations/shared/method`.

Input contract: require the claim ID, named policy document IDs and versions, effective-date metadata as supplied, endorsement sequence, jurisdiction supplied by the operator, evidence cutoff, and authorized licensed coverage or legal reviewer. Do not search for or substitute policy wording that was not supplied and authorized.

Method and checks: inventory every supplied document by title, form or clause ID, version, page/section, effective metadata, source, and supersession relationship. Trace each clause or endorsement to exact asserted facts and evidence IDs using only `matched fact`, `missing fact`, `conflicting fact`, `ambiguous wording`, or `review required`. Verify that quotations and page locators reproduce the supplied source. Record chronology or version conflicts without choosing which contract text governs. Never transform a trace status into a coverage, exclusion, liability, or legal conclusion.

Evidence output: populate the policy-version and endorsement matrix and clause-to-fact trace with applicable domain, source/version, effective-date uncertainty, fact IDs, reviewer owner, and open interpretation question. Return missing or unreadable versions and every mapping that needs licensed review.

Stop when a controlling version cannot be identified from supplied metadata, a document is incomplete or unreadable, jurisdiction is unknown where it changes review ownership, or a requested conclusion requires policy interpretation. Never give insurance or legal advice, decide coverage, or rank claim outcomes; hand off to the authorized licensed adjuster or counsel.
