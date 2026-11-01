"""Positive business oracle and actual zipapp-consumer contracts."""
import json
from pathlib import Path
import tempfile
import unittest
import zipapp
from delivery_verification_scope import cases, grade, same_value

class DeliveryVerificationScopeTest(unittest.TestCase):
    def test_explicit_losses_and_quantities(self):
        self.assertEqual(cases()[0]["expected"]["plan"][0]["order"],9)
        self.assertEqual(cases()[3]["expected"]["validation_mse"],dict(last=3250,open=1000,weekday=0))
        self.assertEqual(same_value({"x":500/7},{"x":71.42857142857143}),True)
        self.assertEqual(same_value({"success":True,"count":0},{"success":True,"count":0}),True)
        self.assertEqual(same_value({"success":False},{"success":False}),True)

    def test_actual_packaged_correct_selection_error_and_plan_error(self):
        # Fixed raw-input lookup validates the consumer, not a reusable forecast solution.
        lookup={f["files"]["train.csv"]:f["expected"] for f in cases()}
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); app=root/"app"; app.mkdir()
            source="import json,sys\nfrom pathlib import Path\nlookup="+repr(lookup)+"\na=sys.argv\nresult=lookup[(Path(a[1])/'train.csv').read_bytes().decode('utf-8')]\n"
            for name, mutation, expected in [("correct","",True),("wrong-selection","result['selected']='last'\n",False),("wrong-plan","result['plan'][0]['order']+=100\n",False)]:
                (app/"__main__.py").write_text(source+mutation+"Path(a[3]).write_text(json.dumps(result),encoding='utf-8')\n",encoding="utf-8")
                zipapp.create_archive(app,root/"deliverable.pyz")
                report=grade("coding",root,root/name)
                self.assertEqual(report["passed"],expected)
                self.assertEqual(len(report["results"]),6)
                if name=="wrong-selection":
                    self.assertEqual([r["released_plan"] for r in report["results"]],[True]*6)
                    self.assertEqual([r["selection"] for r in report["results"]],[False]*6)

if __name__=="__main__": unittest.main()
