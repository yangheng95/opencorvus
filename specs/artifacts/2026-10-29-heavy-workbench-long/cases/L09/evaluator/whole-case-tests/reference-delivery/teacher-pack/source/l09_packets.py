import argparse
from pathlib import Path
from l09_protocol import packet
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True,type=Path);p.add_argument('--out',required=True,type=Path);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
 for n in range(1,7):packet(a.source,n,a.out/f'packet{n}')
