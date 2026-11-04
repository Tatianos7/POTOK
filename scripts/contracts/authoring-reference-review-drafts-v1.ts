import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {buildAuthoringReferenceProposalsV1, readPinnedProposalSourcesV1, type ProposalSourcesRawV1} from './authoring-reference-proposals-v1';

interface Rule {readonly candidate: string|null; readonly reason: string; readonly evidence: readonly string[]}
const retain=(reason:string,...evidence:string[]):Rule=>Object.freeze({candidate:null,reason,evidence:Object.freeze(evidence)});
const candidate=(ndb:string,reason:string,...evidence:string[]):Rule=>Object.freeze({candidate:ndb,reason,evidence:Object.freeze(evidence)});

/** Recommendations for the pinned #315 cases only. These rules are not source admission. */
export const referenceReviewRulesV1:Readonly<Record<string,Rule>>=Object.freeze({
  OATS:retain('Сохранить исходную справку: SR28 не заменяет заявленную Foundation-версию.', 'Точная первичная запись Foundation, версия и сухие овсяные хлопья.'),
  WALNUT:candidate('12155','Предложить точность SR28 вместо округления после проверки класса и исходной ссылки.', 'Съедобное ядро грецкого ореха; исходная ссылка и политика точности.'),
  CINNAMON:candidate('02010','Сопоставить точность молотой корицы; изменение только углеводов пока не переносить.', 'Молотая корица, не экстракт; исходная ссылка и семантика углеводов.'),
  FRESH_STRAWBERRY:retain('Сохранить исходную справку: расхождение версий не решается близостью калорий.', 'Первичная запись заявленного FDC747448 и версия; свежая съедобная ягода.'),
  BLUEBERRY:candidate('09050','Предложить точность SR28 для свежей голубики после проверки исходной ссылки.', 'Свежая сырая голубика; исходная ссылка и политика точности.'),
  EGG:retain('Числовая замена справки не требуется; 50 г на яйцо остаётся справочным весом.', 'Сырое целое яйцо; отдельное основание съедобной массы и дискретного шага.'),
  TURKEY:retain('Не выбирать между целой тушкой и розничной разделкой по одинаковой калорийности.', 'Грудка без кожи, сырое мясо без добавленного раствора; точная форма разделки и источник.'),
  BEEF:retain('Сохранить справку, не расширять узкий класс top round до любой постной говядины.', 'Отруб, сорт, обрезка жира и съедобный ввод должны соответствовать записи 23359.'),
  RABBIT:retain('Сохранить справку; масса мяса с костями не становится массой съедобного мяса.', 'Домашний кролик, применимость смеси отрубов и ввод съедобного мяса без костей.'),
  TUNA:retain('Не выбирать солевой класс и слитую массу по совпадению чисел.', 'Светлый тунец в воде, без соли или с солью; съедобные слитые твёрдые части и источник.'),
  BREADCRUMBS:retain('Сохранить справку простых сухарей до проверки состава.', 'Простые сухие панировочные сухари без добавок; состав и отдельные аллергенные основания.'),
  BREAD:retain('Сохранить справку и исходные штуки; универсального веса ломтика нет.', 'Точная версия или подходящий состав цельнозернового хлеба; отдельное основание массы ломтиков.'),
  POLLOCK:retain('Сохранить исходную справку до получения Foundation-записи; старую SR28 не подставлять.', 'Первичная запись FDC2768188, вид рыбы, заморозка/разморозка, слив и клетчатка.'),
  BUTTER:retain('Солевой класс масла неизвестен; числовую замену не предлагать.', 'Солёное или несолёное масло, жирность/состав и точная первичная запись.'),
  COCOA:retain('Несладкий какао не определяет алкализацию; сохранить справку.', 'Обработка щёлочью или натуральный порошок и точный источник.'),
  FROZEN_STRAWBERRY:candidate('09318','Предложить замороженную несладкую запись вместо несоответствующего сырого сравнения.', 'Замороженная клубника без сахара, весь сок после разморозки сохранён; исходная ссылка и применимость записи.'),
  FROZEN_CURRANT:retain('Сырая смородина с отсутствующей клетчаткой не заменяет замороженную.', 'Замороженная чёрная смородина без сахара; первичные данные клетчатки и сохранённого сока.'),
  BEANS:retain('Не подставлять сухую или иную консервированную фасоль вместо слитой промытой каннеллини.', 'Первичная запись FDC2644287 либо подходящий подтверждённый класс каннеллини; слив/промывание и твёрдые части.'),
  LEMON:retain('Числовая замена справки свежего лимонного сока не требуется.', 'Свежий сырой сок, съедобные граммы и первичный источник; не концентрат и не ложки.'),
  HUMMUS:retain('Сохранить блокировку: коммерческий прокси не определяет состав хумуса.', 'Подходящий подтверждённый состав продукта или полная рецептура POTOK с источниками.'),
  CRISPBREAD:retain('Сохранить блокировку продуктового прокси хлебцев.', 'Ржаные цельнозерновые хлебцы: состав, клетчатка, глютен и масса; не случайный крекер.'),
  DAIRY_MILK:retain('Не выбирать версию молока и не приравнивать мл к граммам.', 'Точный класс/версия молока 2%; источник на объём либо проверенная конверсия для этого класса/продукта.'),
  DAIRY_NATURAL_YOGURT:retain('Натуральный йогурт 2% не заменять автоматически low-fat записью.', 'Натуральный несладкий йогурт: состав, жирность, ферментация и версия источника, включая клетчатку.'),
  DAIRY_GREEK_YOGURT:retain('Не подменять греческий йогурт обычным; сохранить исходную справку.', 'Несладкий процеженный/греческий класс, жирность, состав и первичная версия.'),
  DAIRY_TVOROG:retain('Сохранить NO-GO для обобщённого творога; чужой бренд или cottage cheese не заменяют данные.', 'Полная независимо проверенная обобщённая первичная строка либо отдельно рассмотренное решение по продукту/классу; бренд не обязателен всегда.'),
});

const hash=(raw:string)=>createHash('sha256').update(raw).digest('hex');
const editableAxes=['calories','protein','fat','fiber'] as const;
type Axis=typeof editableAxes[number];
function minor(v:string){const [n,f='']=v.split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));}

/** Rebuild proposals from original-row-bound input; never accept an edited proposal/approval packet. */
export function buildAuthoringReferenceReviewDraftsV1(inputRaw:string,sources:ProposalSourcesRawV1){
  const proposal=buildAuthoringReferenceProposalsV1(inputRaw,sources);
  const recommendations=proposal.proposals.map(row=>{
    if(!Object.hasOwn(referenceReviewRulesV1,row.caseId))throw Error('UNKNOWN_REFERENCE_REVIEW_CASE');
    const rule=referenceReviewRulesV1[row.caseId];
    const source=rule.candidate===null?null:row.options.find(o=>o.sourceRecord===rule.candidate);
    if(rule.candidate!==null&&(!source||source.status!=='CONDITIONAL_SOURCE_VARIANT_COMPARISON'))throw Error('REFERENCE_REVIEW_CANDIDATE_INVALID');
    // A candidate remains visible if quantity evidence blocks its arithmetic, but has no proposed fields.
    const canCompare=source?.impact.status==='CONDITIONAL_LITERAL_REFERENCE_DIFFERENCE';
    const fields:Partial<Record<Axis,{before:string;proposed:string}>>={};
    if(source&&canCompare){
      for(const axis of editableAxes){
        const before=row.beforeReference[axis],after=source.afterReference[axis];
        if(before!==null&&after!==null&&minor(before)!==minor(after))fields[axis]={before,proposed:after};
      }
    }
    const changed=Object.keys(fields).length>0;
    const carbohydrateStatus=source&&row.beforeReference.totalCarbohydrate!==null&&source.afterReference.totalCarbohydrate!==null
      ? (minor(row.beforeReference.totalCarbohydrate)===minor(source.afterReference.totalCarbohydrate)?'NO_LITERAL_DIFFERENCE_SEMANTICS_UNREVIEWED':'DIFFERENCE_WITHHELD_SEMANTICS_UNREVIEWED')
      : 'UNKNOWN_OR_NO_CANDIDATE';
    return {
      ingredientRowId:row.ingredientRowId,recipeId:row.recipeId,caseId:row.caseId,
      sourceAuthoringRowSha256:row.sourceAuthoringRowSha256,
      recommendation:rule.candidate===null?'RETAIN_REFERENCE_PENDING_EVIDENCE':'REVIEW_NAMED_SOURCE_CANDIDATE',
      reason:rule.reason,recommendedOptionId:source?.optionId??row.retainOption.optionId,
      selectedOption:null,ownerDecision:null,
      beforeReference:row.beforeReference,candidateReference:source?.afterReference??null,
      proposedReferenceFields:fields,
      draftStatus:source?(changed?'NUMERIC_REFERENCE_DRAFT_REQUIRES_REVIEW':canCompare?'NO_EDITABLE_NUMERIC_CHANGE':'CANDIDATE_QUANTITY_OR_NUTRIENT_BLOCKED'):'RETAIN_NO_NUMERIC_DRAFT',
      carbohydrateStatus,carbohydrateDelta:null,
      conditionalImpact:source?.impact??null,
      quantity:{recordedUnit:row.recordedUnit,recordedGramsReference:row.recordedGramsReference,
        reviewNeeded:row.recordedUnit==='ML'?'REVIEWED_PER_VOLUME_OR_CLASS_SPECIFIC_MASS_BASIS':row.recordedUnit==='G'?'RECORDED_REFERENCE_GRAMS_NOT_MEASUREMENT':'REVIEWED_DISCRETE_EDIBLE_MASS_AND_STEP',
        quantityChanged:false},
      requiredEvidence:[...rule.evidence,row.requiredEvidence],existingBlockStatus:row.existingBlockStatus,
      reviewGates:['VERIFY_ORIGINAL_REFERENCE_TRANSCRIPTION','VERIFY_PRIMARY_SOURCE_AND_EXACT_CLASS','REVIEW_COMPLETE_NUTRIENT_VECTOR_AND_CARBOHYDRATE_SEMANTICS','OWNER_REVIEW_OF_DRAFT'],
      canApply:false,sourceApproved:false,runtimePublishable:false,
    };
  });
  const caseIds=[...new Set(recommendations.map(r=>r.caseId))].sort();
  const caseDecisions=caseIds.map(caseId=>({caseId,reason:referenceReviewRulesV1[caseId].reason,
    candidateSourceRecord:referenceReviewRulesV1[caseId].candidate,
    rowIds:recommendations.filter(r=>r.caseId===caseId).map(r=>r.ingredientRowId),
    requiredEvidence:referenceReviewRulesV1[caseId].evidence,decisionStatus:'DRAFT_RECOMMENDATION_NOT_APPROVED'}));
  return {
    contract:'potok-authoring-reference-review-drafts-v1',status:'RECOMMENDATIONS_ONLY_OWNER_REVIEW_REQUIRED',
    provenance:{...proposal.provenance,sourceProposalSha256:hash(JSON.stringify(proposal)),
      recommendationRulesSha256:hash(JSON.stringify(referenceReviewRulesV1)),rulesAreNotAuthority:true},
    summary:{rows:recommendations.length,cases:caseIds.length,recipesAffected:proposal.summary.recipesAffected,
      candidateReviewRows:recommendations.filter(r=>r.recommendation==='REVIEW_NAMED_SOURCE_CANDIDATE').length,
      numericDraftRows:recommendations.filter(r=>r.draftStatus==='NUMERIC_REFERENCE_DRAFT_REQUIRES_REVIEW').length,
      proposedFieldDifferences:recommendations.reduce((n,r)=>n+Object.keys(r.proposedReferenceFields).length,0),
      retainPendingEvidenceRows:recommendations.filter(r=>r.recommendation==='RETAIN_REFERENCE_PENDING_EVIDENCE').length,
      selectedChanges:0,appliedChanges:0,sourceApprovals:0},
    caseDecisions,recommendations,recipeImpacts:proposal.recipeImpacts,
    canApply:false,sourceApproved:false,runtimePublishable:false,mayActivate:false,
    originalDataModified:false,recipeTotalsRecomputed:false,physicalCookingBlocksDevelopment:false,
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==3)throw Error('Usage: node --import tsx scripts/contracts/authoring-reference-review-drafts-v1.ts PRIVATE_INPUT.json');
  process.stdout.write(JSON.stringify(buildAuthoringReferenceReviewDraftsV1(readFileSync(process.argv[2],'utf8'),readPinnedProposalSourcesV1()),null,2)+'\n');
}
