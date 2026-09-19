import {buildSync} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const out=resolve('../output/intellipress-review');
mkdirSync('node_modules/.tmp',{recursive:true});
buildSync({entryPoints:['src/lib/guidelines.ts'],bundle:true,format:'esm',outfile:'node_modules/.tmp/nhanes-guidelines.mjs'});
const {gradeBP}=await import(pathToFileURL(resolve('node_modules/.tmp/nhanes-guidelines.mjs')));
const rows=JSON.parse(readFileSync(out+'/records.json','utf8'));
const ref=(s,d)=>s>=180||d>=110?3:s>=160||d>=100?2:s>=140||d>=90?1:s>=120||d>=80?0:-1;
const result={sourceHash:createHash('sha256').update(readFileSync('src/lib/guidelines.ts')).digest('hex'),n:rows.length,modes:{}};
let details=[];
for(const mode of ['peak','mean']){
 let valid=0,errors=0,match=0,tp=0,tn=0,fp=0,fn=0,wtp=0,wtn=0,wfp=0,wfn=0,unknown=0;
 for(const r of rows){
  const s=mode==='peak'?r.peakSbp:r.sbp,d=mode==='peak'?r.peakDbp:r.dbp;
  try{
   const level=gradeBP(s,d).level;valid++;if(level===ref(s,d))match++;
   const pred=level>=1;
   if(r.diagnosed===null){unknown++;continue;}
   if(pred&&r.diagnosed){tp++;wtp+=r.weight;}else if(!pred&&!r.diagnosed){tn++;wtn+=r.weight;}else if(pred){fp++;wfp+=r.weight;}else{fn++;wfn+=r.weight;}
   details.push({...r,mode,level,prediction:pred,error:null});
  }catch(e){errors++;details.push({...r,mode,error:String(e)});}
 }
 const n=tp+tn+fp+fn, wn=wtp+wtn+wfp+wfn;
 result.modes[mode]={valid,errors,coverage:valid/rows.length,reference_matches:match,rule_consistency_among_valid:match/valid,self_report:{n,unknown,tp,tn,fp,fn,agreement:(tp+tn)/n,sensitivity:tp/(tp+fn),specificity:tn/(tn+fp),balanced_accuracy:(tp/(tp+fn)+tn/(tn+fp))/2,majority_baseline:Math.max(tp+fn,tn+fp)/n,weighted_agreement:(wtp+wtn)/wn}};
}
writeFileSync(out+'/evaluation-results.json',JSON.stringify(result,null,2));
writeFileSync(out+'/predictions.json',JSON.stringify(details,null,2));
console.log(JSON.stringify(result,null,2));
