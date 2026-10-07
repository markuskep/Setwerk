#!/usr/bin/env python3
"""Copy canonical web assets, retaining only the Android platform adapters."""
import argparse, hashlib, json, pathlib, shutil
root=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--web',required=True,help='Canonical web project directory containing dist/ and tests/')
parser.add_argument('--commit',required=True,help='Git commit supplying the web source')
args=parser.parse_args()
web=pathlib.Path(args.web).resolve();assets=root/'assets';assets.mkdir(exist_ok=True)
def replace_once(source,old,new):
    if source.count(old)!=1: raise ValueError('Web integration point changed: '+old[:80])
    return source.replace(old,new)
for source in (web/'dist').iterdir():
    if not source.is_file() or source.name=='firebase-service.js': continue
    if source.suffix in {'.png'}: shutil.copy2(source,assets/source.name);continue
    content=source.read_text()
    if source.name=='index.html':
        content=replace_once(content,'<script defer src="exercises.js">','<script defer src="android-bridge.js"></script><script defer src="exercises.js">')
        content=replace_once(content,'<script defer src="app.js"></script>','<script defer src="app.js"></script><script defer src="android-legacy.js"></script>')
    if source.name=='auth.js':
        content=replace_once(content,'if (!unchanged && !window.AndroidGym)','if (!unchanged)')
    if source.name=='app.js':
        content=replace_once(content,'window.AndroidGym?AndroidGym.readState():window.SetwerkCloud?SetwerkCloud.readState():localStorage.getItem(KEY)','window.SetwerkCloud?SetwerkCloud.readState():window.AndroidGym?AndroidGym.readState():localStorage.getItem(KEY)')
        content=replace_once(content,"if(window.AndroidGym){if(!AndroidGym.writeState(raw))throw Error('Speichern fehlgeschlagen');}else if(window.SetwerkCloud)SetwerkCloud.saveLocal(state);","if(window.SetwerkCloud){SetwerkCloud.saveLocal(state);window.AndroidGym?.accountSettings(raw);}else if(window.AndroidGym){if(!AndroidGym.writeState(raw))throw Error('Speichern fehlgeschlagen');}")
        content=replace_once(content,'event=>{if(window.AndroidGym)return;state=G.migrateState(event.detail.state);','event=>{state=G.migrateState(event.detail.state);window.AndroidGym?.accountSettings(JSON.stringify(state));')
        content=replace_once(content,'render();setInterval(tick,250);','if(!storageFault)window.AndroidGym?.accountSettings(JSON.stringify(state));render();setInterval(tick,250);')
    (assets/source.name).write_text(content)
tests=root/'regression-tests';tests.mkdir(exist_ok=True)
for source in (web/'tests').glob('*.test.cjs'):
    if source.name=='account-service.test.cjs': continue # Android service is covered through the native bridge tests.
    (tests/source.name).write_text(source.read_text().replace('../dist/','../assets/').replace("'../dist'","'../assets'"))
files={}
for source in (web/'dist').iterdir():
    if source.is_file():
        target=assets/source.name
        files[source.name]={'web_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'android_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'android_adapter':source.name in {'index.html','app.js','auth.js','firebase-service.js'}}
(root/'SOURCE_VERSION.json').write_text(json.dumps({'androidVersion':'1.4.0','versionCode':5,'webRepository':'markuskep/Setwerk','webBranch':'firebase-migration','webCommit':args.commit,'firebaseProject':'setwerk-cb1e0','files':files},indent=2)+'\n')
print('Android assets updated from web commit',args.commit)
