import test from 'node:test';
import assert from 'node:assert/strict';
import {exactNutritionValuesContractV2,exactNutritionInputContractV2,exactNutritionEncodingV2,exactNutritionBudgetsV2,exactNutritionAxesV2,
 decodeExactScalarV2,exactScalarFromDecimalV2,addExactScalarsV2,subtractExactScalarsV2,multiplyExactScalarsV2,divideExactScalarsV2,compareExactScalarsV2,
 createExactNutritionValuesV2,decodeExactNutritionValuesV2,exactNutritionFromDecimalTextV2,sumExactNutritionValuesV2,scaleExactNutritionValuesV2,
 captureExactNutritionInputV2,decodeExactNutritionInputV2,decodeExactNutritionValuesRawV2,decodeExactNutritionInputRawV2,
 exactNutritionValuesCanonicalRawV2,exactNutritionInputCanonicalRawV2,exactNutritionValuesDigestV2,exactNutritionInputDigestV2,projectExactNutritionForDisplayV2} from '../exactNutritionValuesV2';
import {normalizeFoodEvidenceSourceDecimalV1,nutritionReviewedRevisionCanonicalBytesRawV1} from '../foodReviewedEvidenceV1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../reviewedRuntimeRecipePublicationEvidenceV1';
const q=(numerator:string,denominator='1')=>({numerator,denominator});
const decimal=(value:string)=>({calories:value,protein:value,fat:value,carbs:value,fiber:value});
const packet=(value:string)=>exactNutritionFromDecimalTextV2(decimal(value));
const reference=()=>({sourceRecord:'SYNTHETIC_NUMERIC_INPUT_ONLY',declaredRetainedArtifactSha256:'a'.repeat(64),basis:'PER_100_G_FOOD',
 units:{calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g'},carbohydrateSemantics:'AVAILABLE_EXCLUDING_FIBER',mappingPolicyRef:'UNISSUED_TEST_MAPPING'});

test('source decimals reduce exactly while preserving values beyond the legacy three places',()=>{
 assert.deepEqual(exactScalarFromDecimalV2('12.5000'),q('25','2'));assert.deepEqual(exactScalarFromDecimalV2('0.000'),q('0'));
 assert.deepEqual(exactScalarFromDecimalV2('378.866123'),q('378866123','1000000'));
 assert.deepEqual(exactScalarFromDecimalV2('13.49645'),q('269929','20000'));
 assert.deepEqual(exactScalarFromDecimalV2('583.597022'),q('291798511','500000'));
 assert.throws(()=>normalizeFoodEvidenceSourceDecimalV1('378.866123'));assert.doesNotThrow(()=>packet('378.866123'));
});
test('strict source decimal grammar rejects numbers, missingness, exponents, signs and precision beyond budget',()=>{
 for(const v of [null,undefined,0,'',' 1','1 ','+1','-0','-1','01','1.','1e-3','NaN','Infinity','1000000000','0.'+'1'.repeat(19)])assert.throws(()=>exactScalarFromDecimalV2(v));
 assert.deepEqual(exactScalarFromDecimalV2('999999999.123456789012345678'),q('499999999561728394506172839','500000000000000000'));
});
test('canonical rationals require nonnegative reduced integer strings and unique zero',()=>{
 for(const v of [q('2','6'),q('0','2'),q('1','0'),q('-1','3'),q('01','3'),q('1','03'),{numerator:1,denominator:'3'},q('1.0','3'),{...q('1','3'),sourceApproved:true},q('1'.repeat(81))])assert.throws(()=>decodeExactScalarV2(v));
 assert.deepEqual(decodeExactScalarV2(q('1','3')),q('1','3'));assert.deepEqual(decodeExactScalarV2(q('0')),q('0'));
});
test('one-third survives division, repeated addition, multiplication, subtraction and exact comparison',()=>{
 const third=divideExactScalarsV2(q('1'),q('3'));assert.deepEqual(third,q('1','3'));
 assert.deepEqual(addExactScalarsV2(addExactScalarsV2(third,third),third),q('1'));
 assert.deepEqual(multiplyExactScalarsV2(third,q('3')),q('1'));
 assert.deepEqual(subtractExactScalarsV2(q('1'),third),q('2','3'));
 assert.equal(compareExactScalarsV2(third,exactScalarFromDecimalV2('0.333333333333333333')),1);
 assert.equal(compareExactScalarsV2(third,q('1','3')),0);assert.equal(compareExactScalarsV2(third,q('1')), -1);
 assert.throws(()=>subtractExactScalarsV2(third,q('1')),/NEGATIVE_RESULT/);assert.throws(()=>divideExactScalarsV2(q('1'),q('0')),/DIVISION_BY_ZERO/);
});
test('arithmetic checks final reduced result budgets and permits exact cancellation',()=>{
 const max='9'.repeat(80);assert.deepEqual(multiplyExactScalarsV2(q(max),q('1',max)),q('1'));
 assert.throws(()=>addExactScalarsV2(q(max),q('1')),/RESULT_BUDGET/);assert.throws(()=>multiplyExactScalarsV2(q(max),q('2')),/RESULT_BUDGET/);
 const base=10n**79n;assert.throws(()=>addExactScalarsV2(q('1',String(base+3n)),q('1',String(base+7n))),/RESULT_BUDGET/);
 const p=createExactNutritionValuesV2(Object.fromEntries(['calories','protein','fat','carbs','fiber'].map(a=>[a,q(max)])));
 assert.deepEqual(scaleExactNutritionValuesV2(p,q(max),q(max)).values,p.values);
});
test('five-axis exact packets require a separate version, exact fields and explicit fiber',()=>{
 const p=packet('1');assert.equal(p.contract,exactNutritionValuesContractV2);assert.equal(p.encoding,exactNutritionEncodingV2);
 for(const mutate of [(x:Record<string,unknown>)=>delete x.fiber,(x:Record<string,unknown>)=>{x.fiber=null;},(x:Record<string,unknown>)=>{x.sodium=q('1');}]){const v={...p.values};mutate(v);assert.throws(()=>createExactNutritionValuesV2(v));}
 for(const v of [{...p,contract:'potok-exact-nutrition-values-v1'},{...p,sourceApproved:true},{...p,encoding:'other'},{values:p.values}])assert.throws(()=>decodeExactNutritionValuesV2(v));
 assert.doesNotThrow(()=>packet('0'));
});
test('exact scaling computes source per100g, three declared servings and repeated meals without drift',()=>{
 const source=packet('1'),whole=scaleExactNutritionValuesV2(source,q('100'),q('100')),serving=scaleExactNutritionValuesV2(whole,q('1'),q('3'));
 assert.deepEqual(serving.values.calories,q('1','3'));assert.deepEqual(sumExactNutritionValuesV2([serving,serving,serving]).values,whole.values);
 assert.deepEqual(scaleExactNutritionValuesV2(source,q('0'),q('100')).values,packet('0').values);assert.throws(()=>scaleExactNutritionValuesV2(source,q('1'),q('0')));
});
test('aggregate budgets reject empty, missing, sparse, getter and excess inputs',()=>{
 assert.throws(()=>sumExactNutritionValuesV2([]));assert.throws(()=>sumExactNutritionValuesV2([null]));assert.throws(()=>sumExactNutritionValuesV2(Array(2)));
 const a=[packet('1')];Object.defineProperty(a,'0',{get(){throw Error('getter should not run');}});assert.throws(()=>sumExactNutritionValuesV2(a),/AGGREGATE_INPUT/);
 const extra=Object.assign([packet('1')],{sourceApproved:true});assert.throws(()=>sumExactNutritionValuesV2(extra),/AGGREGATE_INPUT/);
 assert.throws(()=>sumExactNutritionValuesV2(Array(exactNutritionBudgetsV2.aggregateInputs+1).fill(packet('0'))));
 assert.deepEqual(sumExactNutritionValuesV2(Array(exactNutritionBudgetsV2.aggregateInputs).fill(packet('0'))).values,packet('0').values);
});
test('owned immutable snapshots reject accessors and do not retain mutable input objects',()=>{
 const value=q('1','3'),v={calories:value,protein:value,fat:value,carbs:value,fiber:value},p=createExactNutritionValuesV2(v);value.numerator='2';assert.equal(p.values.calories.numerator,'1');assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.values)&&Object.isFrozen(p.values.calories));
 const getter={denominator:'3'};Object.defineProperty(getter,'numerator',{enumerable:true,get(){throw Error('getter should not run');}});assert.throws(()=>decodeExactScalarV2(getter),/FIELDS/);
 const symbol={...q('1'),[Symbol('hidden')]:true};assert.throws(()=>decodeExactScalarV2(symbol));assert.throws(()=>decodeExactScalarV2(Object.create(q('1'))));
 assert.ok(Object.isFrozen(exactNutritionAxesV2)&&Object.isFrozen(exactNutritionBudgetsV2));
});
test('numeric input retains supplied mapped decimal text, declared basis, units and source references',()=>{
 const ref=reference(),input=captureExactNutritionInputV2(ref,decimal('1.23000'));assert.equal(input.contract,exactNutritionInputContractV2);assert.equal(input.mappedDecimalText.fiber,'1.23000');assert.deepEqual(input.values.fiber,q('123','100'));assert.equal(input.reference.basis,'PER_100_G_FOOD');
 ref.sourceRecord='changed';ref.units.fiber='mg';assert.equal(input.reference.sourceRecord,'SYNTHETIC_NUMERIC_INPUT_ONLY');assert.equal(input.reference.units.fiber,'g');assert.ok(Object.isFrozen(input.reference.units));
 assert.deepEqual(decodeExactNutritionInputRawV2(exactNutritionInputCanonicalRawV2(input)),input);
});
test('source references are declarations, not proof; malformed basis, units or semantics reject',()=>{
 for(const patch of [{basis:'UNKNOWN'},{units:{...reference().units,fiber:'mg'}},{carbohydrateSemantics:'TOTAL_INCLUDING_FIBER'},{declaredRetainedArtifactSha256:'ABC'},{mappingPolicyRef:''},{sourceRecord:'\ud800'},{sourceRecord:'bad\ntext'}])assert.throws(()=>captureExactNutritionInputV2({...reference(),...patch},decimal('1')));
 const input=captureExactNutritionInputV2({...reference(),declaredRetainedArtifactSha256:'0'.repeat(64)},decimal('1'));
 assert.equal(input.reference.declaredRetainedArtifactSha256,'0'.repeat(64));assert.ok(!('sourceApproved' in input));
});
test('numeric input decoder binds every exact value to the supplied decimal text',()=>{
 const p=captureExactNutritionInputV2(reference(),decimal('1'));
 const changed=JSON.parse(JSON.stringify(p));changed.values.fiber=q('2');assert.throws(()=>decodeExactNutritionInputV2(changed),/SOURCE_VALUE_MISMATCH/);
 const missing=JSON.parse(JSON.stringify(p));delete missing.mappedDecimalText.fiber;assert.throws(()=>decodeExactNutritionInputV2(missing));
 assert.throws(()=>decodeExactNutritionInputV2({...p,canonicalFoodId:'invented'}));
});
test('canonical bytes are key-order independent and domain separated from mapped input snapshots',async()=>{
 const p=packet('1.2300'),input=captureExactNutritionInputV2(reference(),decimal('1.2300'));
 const reordered={values:Object.fromEntries(Object.entries(p.values).reverse()),encoding:p.encoding,contract:p.contract};
 assert.equal(exactNutritionValuesCanonicalRawV2(p),exactNutritionValuesCanonicalRawV2(reordered));assert.equal(await exactNutritionValuesDigestV2(p),await exactNutritionValuesDigestV2(packet('1.23')));
 assert.notEqual(await exactNutritionValuesDigestV2(p),await exactNutritionInputDigestV2(input));
 assert.notEqual(await exactNutritionInputDigestV2(input),await exactNutritionInputDigestV2(captureExactNutritionInputV2(reference(),decimal('1.23'))));
 const mutable=JSON.parse(exactNutritionValuesCanonicalRawV2(packet('1'))),pending=exactNutritionValuesDigestV2(mutable);mutable.values.calories.numerator='99';assert.equal(await pending,await exactNutritionValuesDigestV2(packet('1')));
});
test('raw parsers reject escaped duplicate keys, trailing content, numbers and nesting/UTF8 budgets',()=>{
 const raw=exactNutritionValuesCanonicalRawV2(packet('1'));
 assert.deepEqual(decodeExactNutritionValuesRawV2(' \n'+raw+'\n'),packet('1'));
 for(const bad of [raw.replace('"numerator":','"\\u006eumerator":"1","numerator":'),raw+'{}',raw.replace('"numerator":"1"','"numerator":1'),'['.repeat(9)+']'.repeat(9),JSON.stringify('а'.repeat(40000)),' '.repeat(65537)])assert.throws(()=>decodeExactNutritionValuesRawV2(bad));
 const input=captureExactNutritionInputV2({...reference(),sourceRecord:'[]{}"\\ [quoted structure]'},decimal('1'));assert.deepEqual(decodeExactNutritionInputRawV2(exactNutritionInputCanonicalRawV2(input)),input);
});
test('display projection rounds half-up exactly at boundaries and does not change authoritative values',()=>{
 const p=scaleExactNutritionValuesV2(packet('1'),q('1'),q('3')),before=exactNutritionValuesCanonicalRawV2(p);
 const projected=projectExactNutritionForDisplayV2(p,{fractionDigits:3,rounding:'HALF_UP'});assert.equal(projected.values.calories,'0.333');assert.equal(projected.authority,'NONE');assert.equal(exactNutritionValuesCanonicalRawV2(p),before);assert.throws(()=>decodeExactNutritionValuesV2(projected));
 for(const [value,text] of [['0.004999','0.00'],['0.005','0.01'],['0.005001','0.01'],['9.995','10.00']])assert.equal(projectExactNutritionForDisplayV2(packet(value),{fractionDigits:2,rounding:'HALF_UP'}).values.calories,text);
 assert.equal(projectExactNutritionForDisplayV2(packet('2.5'),{fractionDigits:0,rounding:'HALF_UP'}).values.calories,'3');
 for(const policy of [{fractionDigits:4,rounding:'HALF_UP'},{fractionDigits:-1,rounding:'HALF_UP'},{fractionDigits:1,rounding:'DOWN'},{fractionDigits:1}])assert.throws(()=>projectExactNutritionForDisplayV2(p,policy));
});
test('displayed one-third values cannot replace exact sums',()=>{
 const third=scaleExactNutritionValuesV2(packet('1'),q('1'),q('3'));const total=sumExactNutritionValuesV2([third,third,third]);assert.equal(projectExactNutritionForDisplayV2(total,{fractionDigits:3,rounding:'HALF_UP'}).values.calories,'1.000');
 assert.notDeepEqual(sumExactNutritionValuesV2([packet('0.333'),packet('0.333'),packet('0.333')]).values,total.values);
});
test('numeric V2 packets and mapped references cannot issue Food evidence or runtime publication',async()=>{
 for(const value of [packet('1'),captureExactNutritionInputV2(reference(),decimal('1'))]){const raw=JSON.stringify(value);assert.throws(()=>nutritionReviewedRevisionCanonicalBytesRawV1(raw));await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));assert.throws(()=>decodeExactNutritionValuesV2({...value,sourceApproved:true}));}
});
test('small exact arithmetic agrees with independently cross-multiplied integer equations',()=>{
 for(let a=0;a<8;a++)for(let b=1;b<8;b++)for(let c=0;c<5;c++)for(let d=1;d<6;d++){
  const left=divideExactScalarsV2(q(String(a)),q(String(b))),right=divideExactScalarsV2(q(String(c)),q(String(d))),sum=addExactScalarsV2(left,right),product=multiplyExactScalarsV2(left,right);
  assert.equal(BigInt(sum.numerator)*BigInt(b*d),BigInt(a*d+c*b)*BigInt(sum.denominator));
  assert.equal(BigInt(product.numerator)*BigInt(b*d),BigInt(a*c)*BigInt(product.denominator));
 }
});
