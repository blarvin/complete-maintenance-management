Data and Persistence:

   Node deletion should persist to all clients on sync.

   Orphaned nodes (no NodeName) should never be persisted to the database, queued for deletion after construction.


DataFieldDetails (and tools and functions):

   Full cascade delete should be implemented.

   DataField deletion should persist to all clients on sync.


CreateDataField:

   CreateDataField picklist should use up and down arrow keys for pick, enter for confirm. (But dont break touch interaction.)


Tree Node Header:

   NodeName and NodeSubtitle should be editable. (UI/UX?)


General UI and UX:
    
   Is it possbile to move focus X and y around the app after initial Tab key activation of Focus?


DataField Component Type: Basic_Key_Value:

   DataFieldValues should not show a double underline while they are being edited. The current underline is an affordance showing it is editable, but adding a secondary underline while editing is confusing.

   DataFieldName and DataFieldValue should show text caret cursor when editing. (We also need to standardize nomenclature for DataField and DataFieldValue.)

   DatField edit should create DataFieldHistory entries immediately. Right now they only appear after closing and re-opening DataFieldDetails.

   Current DataFieldHistory entry should not be selectable for reversion.

   [x] Empty DataFieldHistory entry (from original null value at creation) should not be selectable for reversion.

