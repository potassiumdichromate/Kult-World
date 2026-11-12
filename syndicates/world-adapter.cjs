'use strict';
// SERVER ONLY. Wire after your existing identity verification. Never ship these secrets to browsers.
const crypto=require('node:crypto');
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
function issueLaunch({ownerId,agent,secret,baseUrl,identityMode}){
 if(identityMode!=='kult-gateway')throw Error('Bind the World session to your verified KULT identity before launch.');
 if(!agent?.id||!ownerId||typeof secret!=='string'||secret.length<32)throw Error('Missing verified Agent or launch secret');
 const url=new URL(baseUrl);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Syndicates launch requires HTTPS');
 const p={aud:'kult-syndicates',sub:ownerId,agentId:agent.id,name:String(agent.name||'KULT Agent'),exp:Math.floor(Date.now()/1000)+90,jti:crypto.randomUUID()};
 const raw=Buffer.from(JSON.stringify(p)).toString('base64url');const sig=crypto.createHmac('sha256',secret).update(raw).digest('base64url');url.hash=new URLSearchParams({launch:raw+'.'+sig}).toString();
 return {launchUrl:url.href,expiresAt:p.exp};
}
function verifyDelivery(body,headers,{secret,publicKey}){
 if(!secret||secret.length<32||!publicKey)throw Error('Receipt delivery is not configured');
 const timestamp=Number(headers['x-syndicates-timestamp']);if(!Number.isFinite(timestamp)||Math.abs(Date.now()/1000-timestamp)>90)throw Error('Expired receipt delivery');
 const expected=crypto.createHmac('sha256',secret).update(String(timestamp)+'\n'+crypto.createHash('sha256').update(canonical(body)).digest('hex')).digest();
 const given=Buffer.from(String(headers['x-syndicates-signature']||''),'hex');if(given.length!==expected.length||!crypto.timingSafeEqual(given,expected))throw Error('Invalid delivery signature');
 const {hash,signature,keyId,...core}=body;const rawKey=Buffer.from(publicKey,'base64url');if(rawKey.length!==32)throw Error('Invalid configured Ed25519 public key');
 const key=crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),rawKey]),format:'der',type:'spki'});
 if(!crypto.verify(null,Buffer.from(canonical(core)),key,Buffer.from(signature||'','base64url')))throw Error('Invalid receipt signature');
 if(hash!==crypto.createHash('sha256').update(canonical(core)).digest('hex'))throw Error('Receipt hash mismatch');
 const scopes={
  'switchyard-1.0.0':{type:'NPC',domains:['reconnaissance','negotiation','defense','operations'],outcomes:['SUCCESS','MISS','WITHDRAWN']},
  'switchyard-1.1.0':{type:'NPC',domains:['reconnaissance','negotiation','defense','operations'],outcomes:['SUCCESS','MISS','WITHDRAWN']},
  'switchyard-2.0.0':{type:'NPC',domains:['reconnaissance','negotiation','defense','operations'],outcomes:['SUCCESS','MISS','WITHDRAWN']},
  'switchyard-pvp-1.0.0':{type:'PLAYER',domains:['syndicates_tactics'],outcomes:['SUCCESS','MISS','DRAW','VOID']},
  'switchyard-a2a-1.0.0':{type:'AGENT',domains:['syndicates_services'],outcomes:['SUCCESS','MISS','VOID']}
 };
 const scope=scopes[body.contentVersion];
 if(body.label!=='SERVICE_VERIFIED'||!scope||body.opponentType!==scope.type||!scope.domains.includes(body.domain)||!scope.outcomes.includes(body.outcome))throw Error('Unsupported evidence scope');
 if(body.replayHash!==crypto.createHash('sha256').update(canonical(body.replay)).digest('hex'))throw Error('Replay hash mismatch');
 if(body.seedCommitment!==crypto.createHash('sha256').update(canonical({seed:body.revealedSeed,mission:body.missionId,version:body.contentVersion})).digest('hex'))throw Error('Seed commitment mismatch');
 return body;
}
function ingestIntoOwner(owner,receipt){
 if(!owner?.agent||owner.agent.id!==receipt.agentId)throw Error('Agent identity does not match');
 owner.agent.syndicatesReceipts ||= {};
 const previous=owner.agent.syndicatesReceipts[receipt.id];
 if(previous){if(previous.hash!==receipt.hash)throw Error('Conflicting receipt');return {ok:true,duplicate:true};}
 owner.agent.syndicatesReceipts[receipt.id]=receipt;
 // Intentionally no generic XP, Arena wins, sports calibration or monetary changes.
 return {ok:true,duplicate:false};
}
function passportSummary(agent){return Object.values(agent.syndicatesReceipts||{}).sort((a,b)=>b.createdAt-a.createdAt).slice(0,50).map(({id,missionType,outcome,domain,label,hash,createdAt,opponentType})=>({id,missionType,outcome,domain,label,hash,createdAt,opponentType}));}
module.exports={canonical,issueLaunch,verifyDelivery,ingestIntoOwner,passportSummary};
