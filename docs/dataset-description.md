# Hospital_P2TB Sample Dataset

All items use `dataSource=P2TB_SAMPLE`. The reset script only deletes items with this marker.

The sample data is fictitious and must not contain real medical information, citizen identifiers, insurance numbers, addresses or telephone numbers.

Run:

```powershell
$env:TABLE_NAME = "<CloudFormation TableName output>"
npm run seed:data
npm run verify:data
npm run reset:data
```
