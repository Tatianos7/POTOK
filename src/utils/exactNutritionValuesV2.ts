import {assertRawJsonWithoutDuplicateKeysV1,canonicalJsonV1,adaptiveNutritionSha256HexV1} from './adaptiveNutritionWireV1';

// Pure values, never food evidence, reviewer authority, Graph or a write request.
export const exactNutritionValuesContractV2='potok-exact-nutrition-values-v2' as const;
export const exactNutritionInputContractV2='potok-exact-nutrition-numeric-input-v2' as const;
export const exactNutritionEncodingV2='potok-exact-nutrition-canonical-json-v2' as const;
export const exactNutritionBudgetsV2=Object.freeze({integerDigits:80,sourceIntegerDigits:9,sourceFractionDigits:18,rawBytes:65536,rawDepth:8,aggregateInputs:1024});
export const exactNutritionAxesV2=Object.freeze(['calories','protein','fat','carbs','fiber'] as const);
type Axis=typeof exactNutritionAxesV2[number];
export interface ExactScalarV2 {readonly numerator:string;readonly denominator:string}
export type ExactNutritionVectorV2=Readonly<Record<Axis,ExactScalarV2>>;
export type NutritionDecimalTextV2=Readonly<Record<Axis,string>>;
export interface ExactNutritionValuesV2 {readonly contract:typeof exactNutritionValuesContractV2;readonly encoding:typeof exactNutritionEncodingV2;readonly values:ExactNutritionVectorV2}
export interface NumericSourceReferenceV2 {
 readonly sourceRecord:string;readonly declaredRetainedArtifactSha256:string;
 readonly basis:'PER_100_G_EDIBLE'|'PER_100_G_FOOD';
 readonly units:Readonly<{calories:'kcal';protein:'g';fat:'g';carbs:'g';fiber:'g'}>;
 readonly carbohydrateSemantics:'AVAILABLE_EXCLUDING_FIBER';readonly mappingPolicyRef:string;
}
export interface ExactNutritionInputV2 {
 readonly contract:typeof exactNutritionInputContractV2;readonly encoding:typeof exactNutritionEncodingV2;
 readonly reference:NumericSourceReferenceV2;readonly mappedDecimalText:NutritionDecimalTextV2;readonly values:ExactNutritionVectorV2;
}
export interface ExactDisplayPolicyV2 {readonly fractionDigits:0|1|2|3;readonly rounding:'HALF_UP'}
type Obj=Record<string,unknown>;
function fail(reason:string):never{throw Error('EXACT_NUTRITION_V2_'+reason);}
function record(value:unknown,keys:readonly string[]):Obj{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length)fail('FIELDS');
 const descriptors=Object.getOwnPropertyDescriptors(value);const result:Obj={};
 for(const key of keys){const d=descriptors[key];if(!d||!('value' in d)||!d.enumerable)fail('FIELDS');result[key]=d.value;}
 return result;
}
function integer(value:unknown):bigint{
 if(typeof value!=='string'||value.length>exactNutritionBudgetsV2.integerDigits||!/^(0|[1-9][0-9]*)$/.test(value))fail('INTEGER');
 return BigInt(value);
}
function gcd(a:bigint,b:bigint):bigint{while(b){const r=a%b;a=b;b=r;}return a;}
function reduced(n:bigint,d:bigint):ExactScalarV2{
 if(n<0n)fail('NEGATIVE_RESULT');if(d<=0n)fail('DIVISION_BY_ZERO');const g=gcd(n,d),numerator=String(n/g),denominator=String(d/g);
 if(numerator.length>exactNutritionBudgetsV2.integerDigits||denominator.length>exactNutritionBudgetsV2.integerDigits)fail('RESULT_BUDGET');
 return Object.freeze({numerator,denominator});
}
export function decodeExactScalarV2(value:unknown):ExactScalarV2{
 const r=record(value,['numerator','denominator']),n=integer(r.numerator),d=integer(r.denominator);
 if(d===0n)fail('DIVISION_BY_ZERO');if(gcd(n,d)!==1n)fail('NONCANONICAL_FRACTION');
 return Object.freeze({numerator:String(n),denominator:String(d)});
}
export function exactScalarFromDecimalV2(value:unknown):ExactScalarV2{
 if(typeof value!=='string'||value.length>exactNutritionBudgetsV2.sourceIntegerDigits+exactNutritionBudgetsV2.sourceFractionDigits+1
  ||!/^(0|[1-9][0-9]{0,8})(\.[0-9]{1,18})?$/.test(value))fail('SOURCE_DECIMAL');
 const [whole,fraction='']=value.split('.');return reduced(BigInt(whole+fraction),10n**BigInt(fraction.length));
}
export function addExactScalarsV2(left:unknown,right:unknown):ExactScalarV2{
 const a=decodeExactScalarV2(left),b=decodeExactScalarV2(right),an=BigInt(a.numerator),ad=BigInt(a.denominator),bn=BigInt(b.numerator),bd=BigInt(b.denominator),g=gcd(ad,bd);
 return reduced(an*(bd/g)+bn*(ad/g),(ad/g)*bd);
}
export function subtractExactScalarsV2(left:unknown,right:unknown):ExactScalarV2{
 const a=decodeExactScalarV2(left),b=decodeExactScalarV2(right),ad=BigInt(a.denominator),bd=BigInt(b.denominator),g=gcd(ad,bd);
 return reduced(BigInt(a.numerator)*(bd/g)-BigInt(b.numerator)*(ad/g),(ad/g)*bd);
}
export function multiplyExactScalarsV2(left:unknown,right:unknown):ExactScalarV2{
 const a=decodeExactScalarV2(left),b=decodeExactScalarV2(right);
 return reduced(BigInt(a.numerator)*BigInt(b.numerator),BigInt(a.denominator)*BigInt(b.denominator));
}
export function divideExactScalarsV2(left:unknown,right:unknown):ExactScalarV2{
 const a=decodeExactScalarV2(left),b=decodeExactScalarV2(right);if(b.numerator==='0')fail('DIVISION_BY_ZERO');
 return reduced(BigInt(a.numerator)*BigInt(b.denominator),BigInt(a.denominator)*BigInt(b.numerator));
}
export function compareExactScalarsV2(left:unknown,right:unknown):-1|0|1{
 const a=decodeExactScalarV2(left),b=decodeExactScalarV2(right),x=BigInt(a.numerator)*BigInt(b.denominator),y=BigInt(b.numerator)*BigInt(a.denominator);
 return x<y?-1:x>y?1:0;
}
function vector(value:unknown):ExactNutritionVectorV2{
 const r=record(value,exactNutritionAxesV2);return Object.freeze(Object.fromEntries(exactNutritionAxesV2.map(a=>[a,decodeExactScalarV2(r[a])]))) as ExactNutritionVectorV2;
}
export function createExactNutritionValuesV2(values:unknown):ExactNutritionValuesV2{
 return Object.freeze({contract:exactNutritionValuesContractV2,encoding:exactNutritionEncodingV2,values:vector(values)});
}
export function decodeExactNutritionValuesV2(value:unknown):ExactNutritionValuesV2{
 const r=record(value,['contract','encoding','values']);if(r.contract!==exactNutritionValuesContractV2||r.encoding!==exactNutritionEncodingV2)fail('CONTRACT');
 return createExactNutritionValuesV2(r.values);
}
export function exactNutritionFromDecimalTextV2(value:unknown):ExactNutritionValuesV2{
 const r=record(value,exactNutritionAxesV2);return createExactNutritionValuesV2(Object.fromEntries(exactNutritionAxesV2.map(a=>[a,exactScalarFromDecimalV2(r[a])])));
}
export function sumExactNutritionValuesV2(values:readonly unknown[]):ExactNutritionValuesV2{
 if(!Array.isArray(values)||Object.getPrototypeOf(values)!==Array.prototype||!values.length||values.length>exactNutritionBudgetsV2.aggregateInputs)fail('AGGREGATE_BUDGET');
 if(Reflect.ownKeys(values).length!==values.length+1)fail('AGGREGATE_INPUT');
 const packets:ExactNutritionValuesV2[]=[];
 for(let i=0;i<values.length;i++){const d=Object.getOwnPropertyDescriptor(values,String(i));if(!d||!('value' in d))fail('AGGREGATE_INPUT');packets.push(decodeExactNutritionValuesV2(d.value));}
 return createExactNutritionValuesV2(Object.fromEntries(exactNutritionAxesV2.map(a=>[a,packets.reduce((s,p)=>addExactScalarsV2(s,p.values[a]),{numerator:'0',denominator:'1'})])));
}
export function scaleExactNutritionValuesV2(value:unknown,multiplier:unknown,divisor:unknown):ExactNutritionValuesV2{
 const p=decodeExactNutritionValuesV2(value),m=decodeExactScalarV2(multiplier),d=decodeExactScalarV2(divisor);if(d.numerator==='0')fail('DIVISION_BY_ZERO');
 // Fuse the operation before reduction so cancellation is not rejected because
 // of a hypothetical over-budget intermediate product.
 return createExactNutritionValuesV2(Object.fromEntries(exactNutritionAxesV2.map(a=>{const x=p.values[a];return [a,reduced(BigInt(x.numerator)*BigInt(m.numerator)*BigInt(d.denominator),BigInt(x.denominator)*BigInt(m.denominator)*BigInt(d.numerator))];})));
}
function text(value:unknown):string{
 if(typeof value!=='string'||!value.trim()||value.length>256)fail('REFERENCE_TEXT');
 for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))fail('UNICODE');}else if(c>=0xdc00&&c<=0xdfff)fail('UNICODE');if(c<32)fail('REFERENCE_TEXT');}
 return value;
}
function reference(value:unknown):NumericSourceReferenceV2{
 const r=record(value,['sourceRecord','declaredRetainedArtifactSha256','basis','units','carbohydrateSemantics','mappingPolicyRef']);
 const sourceRecord=text(r.sourceRecord),hash=text(r.declaredRetainedArtifactSha256),mappingPolicyRef=text(r.mappingPolicyRef);
 if(!/^[a-f0-9]{64}$/.test(hash))fail('REFERENCE_DIGEST');if(r.basis!=='PER_100_G_EDIBLE'&&r.basis!=='PER_100_G_FOOD')fail('BASIS');
 if(r.carbohydrateSemantics!=='AVAILABLE_EXCLUDING_FIBER')fail('CARBOHYDRATE_SEMANTICS');
 const units=record(r.units,exactNutritionAxesV2);for(const a of exactNutritionAxesV2)if(units[a]!== (a==='calories'?'kcal':'g'))fail('UNITS');
 return Object.freeze({sourceRecord,declaredRetainedArtifactSha256:hash,basis:r.basis,units:Object.freeze({calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g'}),carbohydrateSemantics:'AVAILABLE_EXCLUDING_FIBER',mappingPolicyRef});
}
export function captureExactNutritionInputV2(sourceReference:unknown,mappedDecimalText:unknown):ExactNutritionInputV2{
 const ref=reference(sourceReference),r=record(mappedDecimalText,exactNutritionAxesV2),p=exactNutritionFromDecimalTextV2(r);
 const owned=Object.freeze(Object.fromEntries(exactNutritionAxesV2.map(a=>[a,r[a]]))) as NutritionDecimalTextV2;
 return Object.freeze({contract:exactNutritionInputContractV2,encoding:exactNutritionEncodingV2,reference:ref,mappedDecimalText:owned,values:p.values});
}
export function decodeExactNutritionInputV2(value:unknown):ExactNutritionInputV2{
 const r=record(value,['contract','encoding','reference','mappedDecimalText','values']);if(r.contract!==exactNutritionInputContractV2||r.encoding!==exactNutritionEncodingV2)fail('CONTRACT');
 const expected=captureExactNutritionInputV2(r.reference,r.mappedDecimalText),provided=vector(r.values);
 for(const a of exactNutritionAxesV2)if(provided[a].numerator!==expected.values[a].numerator||provided[a].denominator!==expected.values[a].denominator)fail('SOURCE_VALUE_MISMATCH');
 return expected;
}
function raw(rawValue:unknown):unknown{
 if(typeof rawValue!=='string'||rawValue.length>exactNutritionBudgetsV2.rawBytes||new TextEncoder().encode(rawValue).byteLength>exactNutritionBudgetsV2.rawBytes)fail('RAW_BUDGET');
 // Bound nesting before the shared recursive duplicate-aware scanner. Brackets
 // inside escaped JSON strings are not structural depth.
 let quoted=false,escaped=false,depth=0;
 for(const c of rawValue){if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{'||c==='['){if(++depth>exactNutritionBudgetsV2.rawDepth)fail('RAW_DEPTH');}else if(c==='}'||c===']'){if(--depth<0)fail('RAW_JSON');}}
 assertRawJsonWithoutDuplicateKeysV1(rawValue);return JSON.parse(rawValue) as unknown;
}
export const decodeExactNutritionValuesRawV2=(rawValue:unknown)=>decodeExactNutritionValuesV2(raw(rawValue));
export const decodeExactNutritionInputRawV2=(rawValue:unknown)=>decodeExactNutritionInputV2(raw(rawValue));
export const exactNutritionValuesCanonicalRawV2=(value:unknown)=>canonicalJsonV1(decodeExactNutritionValuesV2(value));
export const exactNutritionInputCanonicalRawV2=(value:unknown)=>canonicalJsonV1(decodeExactNutritionInputV2(value));
export function exactNutritionValuesDigestV2(value:unknown):Promise<string>{return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({domain:'potok-exact-nutrition-values-sha256-v2',value:decodeExactNutritionValuesV2(value)})));}
export function exactNutritionInputDigestV2(value:unknown):Promise<string>{return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({domain:'potok-exact-nutrition-numeric-input-sha256-v2',value:decodeExactNutritionInputV2(value)})));}
export function projectExactNutritionForDisplayV2(value:unknown,policy:unknown){
 const p=decodeExactNutritionValuesV2(value),r=record(policy,['fractionDigits','rounding']);
 if(!Number.isSafeInteger(r.fractionDigits)||Number(r.fractionDigits)<0||Number(r.fractionDigits)>3||r.rounding!=='HALF_UP')fail('DISPLAY_POLICY');
 const digits=Number(r.fractionDigits),scale=10n**BigInt(digits);
 const values=Object.freeze(Object.fromEntries(exactNutritionAxesV2.map(a=>{const q=p.values[a],n=BigInt(q.numerator),d=BigInt(q.denominator),v=(2n*n*scale+d)/(2n*d);return [a,digits===0?String(v):String(v/scale)+'.'+String(v%scale).padStart(digits,'0')];}))) as NutritionDecimalTextV2;
 return Object.freeze({contract:'potok-exact-nutrition-display-only-v2' as const,authority:'NONE' as const,rounding:'HALF_UP' as const,fractionDigits:digits,values});
}
