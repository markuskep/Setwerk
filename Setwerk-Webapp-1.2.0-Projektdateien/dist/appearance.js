/* Account appearance is separate from workout snapshots for older app compatibility. */
window.SetwerkAppearance=(()=>{
  const themes=['standard','cherry','orange','black-white'],prefix='setwerk.firebase.appearance.v1.';
  let user=null,theme='standard',pending=false,mode='guest',epoch=0,flight=null;
  function emit(){window.dispatchEvent(new CustomEvent('setwerk:appearance-state'));}
  function apply(value){
    theme=themes.includes(value)?value:'standard';document.documentElement.dataset.theme=theme;
    const colors={standard:['#111714','#d2f96a'],cherry:['#29121d','#ff9eb8'],orange:['#281a0e','#ffc078'],'black-white':['#151515','#ffffff']}[theme];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',colors[0]);
    document.querySelector('link[rel="icon"]')?.setAttribute('href','data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${colors[0]}"/><path d="M18 19v26m28-26v26M12 25v14m40-14v14M18 32h28" stroke="${colors[1]}" stroke-width="6" stroke-linecap="round"/></svg>`));
  }
  function persist(){localStorage.setItem(prefix+user.id,JSON.stringify({theme,pending}));}
  function connect(next){
    if(user?.id!==next?.id){
      ++epoch;flight=null;user=next?.id?{id:next.id}:null;pending=false;mode=user?'loading':'guest';
      let saved;try{saved=user?JSON.parse(localStorage.getItem(prefix+user.id)||'null'):null;}catch{}
      apply(saved?.theme);pending=!!saved?.pending&&themes.includes(saved.theme);emit();
    }
    if(user)void sync();
  }
  async function sync(){
    if(!user||!window.SetwerkFirebase?.readAppearance||!window.SetwerkFirebase?.writeAppearance)return;
    if(flight)return flight;
    const owner=user.id,token=epoch,valid=()=>user?.id===owner&&epoch===token;
    mode='syncing';emit();
    const job=(async()=>{
      try{
        if(!pending){const remote=await window.SetwerkFirebase.readAppearance(owner);if(!valid())return;if(!pending){apply(remote);persist();}}
        while(valid()&&pending){const selected=theme;await window.SetwerkFirebase.writeAppearance(owner,selected);if(!valid())return;if(theme===selected){pending=false;persist();}}
        if(valid())mode='synced';
      }catch{if(valid())mode='offline';}finally{if(valid()){flight=null;emit();}}
    })();flight=job;return job;
  }
  function select(value){
    if(!user||!themes.includes(value))throw Error('Invalid color scheme');
    localStorage.setItem(prefix+user.id,JSON.stringify({theme:value,pending:true}));
    apply(value);pending=true;mode='pending';emit();void sync();
  }
  window.addEventListener('online',()=>void sync());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void sync();});
  connect(window.SetwerkCloud?.user||null);
  return{connect,select,sync,themes,get theme(){return theme;},get mode(){return mode;}};
})();
