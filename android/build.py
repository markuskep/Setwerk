#!/usr/bin/env python3
"""Build and sign Setwerk without embedding private signing material in sources."""
import argparse, os, pathlib, shutil, subprocess, zipfile
root=pathlib.Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--tools',required=True,help='Android SDK Build Tools directory (35.0.0)')
p.add_argument('--platform',required=True,help='Android SDK android.jar (API 35)')
p.add_argument('--compiler',help='Optional Eclipse ECJ jar; otherwise uses javac')
p.add_argument('--signing',required=True,help='Private signing.properties outside this project')
p.add_argument('--keystore',required=True,help='Private existing Setwerk 1.1 JKS file')
p.add_argument('--output',required=True)
args=p.parse_args()
tools=pathlib.Path(args.tools).resolve();platform=pathlib.Path(args.platform).resolve();build=root/'build';build.mkdir(exist_ok=True)
for name in ['gen','classes','dex']:
 d=build/name
 if d.exists():shutil.rmtree(d)
 d.mkdir()
def run(command,**kwargs):subprocess.run([str(s) for s in command],check=True,**kwargs)
run([tools/'aapt','package','-f','-m','-J',build/'gen','-M',root/'AndroidManifest.xml','-S',root/'res','-A',root/'assets','-I',platform,'-F',build/'unsigned.apk'])
sources=list((root/'src').rglob('*.java'))+list((build/'gen').rglob('*.java'))
if args.compiler:run(['java','-jar',pathlib.Path(args.compiler).resolve(),'-8','-proc:none','-warn:none','-classpath',platform,'-d',build/'classes',*sources])
else:run(['javac','--release','8','-classpath',platform,'-d',build/'classes',*sources])
with zipfile.ZipFile(build/'classes.jar','w',zipfile.ZIP_DEFLATED) as z:
 for f in (build/'classes').rglob('*.class'):z.write(f,f.relative_to(build/'classes'))
run(['java','-cp',tools/'lib/d8.jar','com.android.tools.r8.D8','--release','--min-api','26','--lib',platform,'--output',build/'dex',build/'classes.jar'])
with zipfile.ZipFile(build/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:
 for f in (build/'dex').glob('*.dex'):z.write(f,f.name)
run([tools/'zipalign','-f','-p','4',build/'unsigned.apk',build/'aligned.apk'])
props={}
for line in pathlib.Path(args.signing).read_text().splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  key,value=line.split('=',1);props[key.strip()]=value.strip()
env=os.environ.copy();env['SETWERK_SIGN_STORE_PASSWORD']=props['storePassword'];env['SETWERK_SIGN_KEY_PASSWORD']=props['keyPassword']
output=pathlib.Path(args.output).resolve();output.parent.mkdir(exist_ok=True,parents=True)
run(['java','-jar',tools/'lib/apksigner.jar','sign','--ks',pathlib.Path(args.keystore).resolve(),'--ks-key-alias',props['keyAlias'],'--ks-pass','env:SETWERK_SIGN_STORE_PASSWORD','--key-pass','env:SETWERK_SIGN_KEY_PASSWORD','--out',output,build/'aligned.apk'],env=env)
run(['java','-jar',tools/'lib/apksigner.jar','verify','--verbose',output])
print('Built and verified:',output)
