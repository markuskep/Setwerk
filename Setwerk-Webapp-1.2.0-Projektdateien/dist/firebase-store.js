/* Firestore snapshot transport. Active workouts remain in local storage. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SetwerkFirebaseStore=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_BYTES=800000;
  function failure(message,status){const error=Error(message);error.status=status;return error;}
  function create(sdk){
    const {auth,db,doc,getDocFromServer,runTransaction,serverTimestamp}=sdk;
    function ownerRef(owner){
      if(!owner||auth.currentUser?.uid!==owner)throw failure('Please sign in again',401);
      return doc(db,'users',owner,'state','main');
    }
    function decode(snapshot){
      if(!snapshot.exists())return{revision:0,data:null};
      const value=snapshot.data();
      if(!Number.isSafeInteger(value.revision)||value.revision<1||typeof value.payload!=='string')throw failure('Invalid cloud data',422);
      return{revision:value.revision,data:JSON.parse(value.payload)};
    }
    async function read(owner){return decode(await getDocFromServer(ownerRef(owner)));}
    async function write(owner,revision,data){
      if(!Number.isSafeInteger(revision)||revision<0)throw failure('Invalid revision',422);
      const payload=JSON.stringify(data);
      if(new TextEncoder().encode(payload).length>MAX_BYTES)throw failure('Cloud storage limit reached',413);
      const ref=ownerRef(owner);
      return runTransaction(db,async transaction=>{
        const current=decode(await transaction.get(ref));
        ownerRef(owner);
        if(current.revision!==revision)throw failure('Cloud data changed on another device',409);
        const next=current.revision+1;
        transaction.set(ref,{revision:next,payload,updatedAt:serverTimestamp()});
        return{revision:next,data:null};
      });
    }
    return{read,write};
  }
  function normalizeError(error){
    if(error.status)return error;
    const status={'permission-denied':403,'unauthenticated':401,'not-found':503,'failed-precondition':503,'resource-exhausted':429}[String(error.code||'').replace(/^firestore\//,'')];
    if(status)error.status=status;
    return error;
  }
  return{create,normalizeError,MAX_BYTES};
});
