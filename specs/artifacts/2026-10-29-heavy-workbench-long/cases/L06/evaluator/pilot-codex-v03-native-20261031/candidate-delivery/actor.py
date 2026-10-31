# Root entry point; the compact sealed programme is the preferred exercise project.
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent/'programme'))
from actor import main
if __name__=='__main__':raise SystemExit(main())
