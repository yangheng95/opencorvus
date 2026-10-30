import argparse
from pathlib import Path
from l09_protocol import collect,evaluate
from l09_lab import save
def main():
 p=argparse.ArgumentParser();p.add_argument('--student',required=True,type=Path);p.add_argument('--data',required=True,type=Path);p.add_argument('--out',required=True,type=Path);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
 collect(a.student,a.data,a.out/'actual-work');save(a.out/'grade.json',evaluate(a.data,a.out/'actual-work'))
if __name__=='__main__':main()
