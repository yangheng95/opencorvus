# Office Delivery

Office Delivery creates editable, evidence-backed documents, spreadsheets, presentations, PDFs, or coordinated packs. Source analysis and format design are independent root branches. The builder is their explicit join; the quality reviewer examines the actual produced files and rendered outputs.

The package-local `office-delivery-method` Skill is a clean-room OpenCorvus method. No third-party office Skill content was copied or adapted because the candidate source did not establish a package-wide license for each Skill.

## Binding workflow

`verified-office-delivery` is the only workflow. The scheduler dispatches source analysis and format design in parallel, waits for both, dispatches the builder, and then dispatches the quality reviewer.

## Delivery contract

Every requested format is tracked separately. Editable sources are the canonical authoring surface; exports derive from them. The final report distinguishes file creation, format validation, content verification, and rendered visual acceptance, and identifies any format that remains blocked or unverified.
