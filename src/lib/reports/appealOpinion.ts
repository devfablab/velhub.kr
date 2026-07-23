import type { AppealOpinionContext, ReportAppealCategory } from '@/lib/reports/appeals';

export type AppealOpinionOption = {
  value: string;
  label: string;
};

type VisibilityCondition = {
  source: 'values' | 'context';
  key: string;
  values: Array<string | boolean>;
};

export type AppealOpinionField = {
  key: string;
  label: string;
  type: 'text' | 'select';
  helperText: string;
  options?: AppealOpinionOption[];
  visibleWhenAll?: VisibilityCondition[];
  visibleWhenAny?: VisibilityCondition[];
};

const commonPositionOptions: AppealOpinionOption[] = [
  { value: 'accept_all', label: '신고 내용 전부 인정' },
  { value: 'accept_part', label: '신고 내용 일부 인정' },
  { value: 'dispute', label: '신고 내용에 이의 있음' },
];

export const appealOpinionPositionOptions: Record<ReportAppealCategory, AppealOpinionOption[]> = {
  illegal_info: commonPositionOptions,
  illegal_filming: [
    { value: 'accept_all', label: '신고 내용 전부 인정' },
    { value: 'accept_part', label: '신고 내용 일부 인정' },
    { value: 'not_illegal_filming', label: '해당 자료는 불법촬영물등에 해당하지 않음' },
  ],
  privacy: [
    { value: 'accept_included', label: '개인정보가 포함된 사실 인정' },
    { value: 'accept_partially_included', label: '개인정보가 일부 포함된 사실 인정' },
    { value: 'not_personal_information', label: '해당 정보는 개인정보에 해당하지 않음' },
    { value: 'has_publication_basis', label: '개인정보이지만 게시할 근거가 있음' },
    { value: 'not_included', label: '신고된 정보가 포함되어 있지 않음' },
  ],
  defamation: commonPositionOptions,
  personality_rights: commonPositionOptions,
};

const illegalInfoFields: AppealOpinionField[] = [
  {
    key: 'explanation',
    label: '소명 내용',
    type: 'text',
    helperText: '해당 내용이 불법정보 또는 허위조작정보에 해당하지 않는다고 판단하는 이유와 실제 사실관계를 작성해 주세요.',
  },
  {
    key: 'source_basis',
    label: '작성 근거 및 출처',
    type: 'text',
    helperText: '작성 당시 확인한 자료, 정보의 출처와 사실관계를 확인한 과정을 작성해 주세요.',
  },
  {
    key: 'editing_status',
    label: '편집·가공 여부',
    type: 'select',
    helperText: '원본 자료의 편집 또는 가공 여부를 선택해 주세요.',
    options: [
      { value: 'not_edited', label: '편집하거나 가공하지 않음' },
      { value: 'edited', label: '일부 편집하거나 가공함' },
    ],
    visibleWhenAll: [{ source: 'context', key: 'hasFalseManipulatedInfo', values: [true] }],
  },
  {
    key: 'editing_scope',
    label: '편집·가공한 범위와 이유',
    type: 'text',
    helperText: '원본에서 변경한 부분과 변경한 이유를 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'editing_status', values: ['edited'] }],
  },
];

const illegalFilmingFields: AppealOpinionField[] = [
  {
    key: 'explanation',
    label: '소명 내용',
    type: 'text',
    helperText: '해당 자료가 불법촬영물등에 해당하지 않는다고 판단하는 이유와 실제 사실관계를 작성해 주세요.',
  },
  {
    key: 'source_acquisition',
    label: '자료의 출처 및 취득 경위',
    type: 'text',
    helperText: '신고된 이미지·영상·음성의 출처와 해당 자료를 취득한 경위를 작성해 주세요.',
  },
  {
    key: 'filming_circumstances',
    label: '촬영 경위',
    type: 'text',
    helperText: '해당 자료를 누가 어떤 장소와 상황에서 촬영했는지 작성해 주세요.',
    visibleWhenAll: [{ source: 'context', key: 'hasIllegalFilming', values: [true] }],
  },
  {
    key: 'filming_consent',
    label: '촬영 동의 여부',
    type: 'select',
    helperText: '촬영대상자의 촬영 동의 여부를 선택해 주세요.',
    options: [
      { value: 'consented', label: '촬영대상자가 촬영에 동의함' },
      { value: 'not_consented', label: '촬영대상자가 촬영에 동의하지 않음' },
      { value: 'unknown', label: '촬영 동의 여부를 확인할 수 없음' },
      { value: 'self_filmed', label: '촬영대상자가 직접 촬영함' },
    ],
    visibleWhenAll: [{ source: 'context', key: 'hasIllegalFilming', values: [true] }],
  },
  {
    key: 'filming_consent_basis',
    label: '촬영 동의의 범위와 근거',
    type: 'text',
    helperText: '촬영대상자가 동의한 촬영의 범위와 근거를 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'filming_consent', values: ['consented'] }],
  },
  {
    key: 'distribution_consent',
    label: '게시·유통 동의 여부',
    type: 'select',
    helperText: '촬영대상자의 게시·유통 동의 여부를 선택해 주세요.',
    options: [
      { value: 'same_scope', label: '현재와 같은 범위의 게시·유통에 동의함' },
      { value: 'limited_scope', label: '제한된 범위의 게시·유통에만 동의함' },
      { value: 'not_consented', label: '게시·유통에 동의하지 않음' },
      { value: 'unknown', label: '게시·유통 동의 여부를 확인할 수 없음' },
    ],
    visibleWhenAll: [{ source: 'context', key: 'hasIllegalFilming', values: [true] }],
  },
  {
    key: 'distribution_consent_basis',
    label: '게시·유통 동의의 범위와 근거',
    type: 'text',
    helperText: '게시가 허용된 서비스, 공개 대상, 공개 기간과 동의 근거를 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'distribution_consent', values: ['same_scope', 'limited_scope'] }],
  },
  {
    key: 'manipulation_status',
    label: '편집·합성·가공 여부',
    type: 'select',
    helperText: '자료의 편집·합성·가공 여부를 선택해 주세요.',
    options: [
      { value: 'manipulated', label: '편집·합성·가공함' },
      { value: 'not_manipulated', label: '편집·합성·가공하지 않음' },
      { value: 'third_party', label: '제3자가 편집·합성·가공한 자료를 게시함' },
      { value: 'unknown', label: '확인할 수 없음' },
    ],
    visibleWhenAll: [{ source: 'context', key: 'hasDeepfake', values: [true] }],
  },
  {
    key: 'manipulation_details',
    label: '편집·합성·가공한 내용',
    type: 'text',
    helperText: '사용한 원본과 편집·합성·가공한 부분을 구체적으로 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'manipulation_status', values: ['manipulated', 'third_party'] }],
  },
  {
    key: 'production_circumstances',
    label: '제작 경위',
    type: 'text',
    helperText: '해당 자료를 누가 어떤 목적으로 제작했는지 작성해 주세요.',
    visibleWhenAll: [{ source: 'context', key: 'hasDeepfake', values: [true] }],
  },
  {
    key: 'production_consent',
    label: '대상자의 제작 동의 여부',
    type: 'select',
    helperText: '대상자의 제작 동의 여부를 선택해 주세요.',
    options: [
      { value: 'consented', label: '제작에 동의함' },
      { value: 'not_consented', label: '제작에 동의하지 않음' },
      { value: 'unknown', label: '제작 동의 여부를 확인할 수 없음' },
    ],
    visibleWhenAll: [{ source: 'context', key: 'hasDeepfake', values: [true] }],
  },
  {
    key: 'target_distribution_consent',
    label: '대상자의 게시·유통 동의 여부',
    type: 'select',
    helperText: '대상자의 게시·유통 동의 여부를 선택해 주세요.',
    options: [
      { value: 'same_scope', label: '현재와 같은 범위의 게시·유통에 동의함' },
      { value: 'limited_scope', label: '제한된 범위의 게시·유통에만 동의함' },
      { value: 'not_consented', label: '게시·유통에 동의하지 않음' },
      { value: 'unknown', label: '게시·유통 동의 여부를 확인할 수 없음' },
    ],
    visibleWhenAll: [{ source: 'context', key: 'hasDeepfake', values: [true] }],
  },
  {
    key: 'production_distribution_basis',
    label: '제작 및 게시·유통 동의의 범위와 근거',
    type: 'text',
    helperText: '대상자가 제작과 게시·유통에 동의한 범위와 근거를 작성해 주세요.',
    visibleWhenAny: [
      { source: 'values', key: 'production_consent', values: ['consented'] },
      { source: 'values', key: 'target_distribution_consent', values: ['same_scope', 'limited_scope'] },
    ],
  },
  {
    key: 'not_child_exploitation_reason',
    label: '아동·청소년성착취물에 해당하지 않는다고 판단한 이유',
    type: 'text',
    helperText: '등장하는 사람 또는 표현물이 아동·청소년으로 인식되는지와 신고 자료에 대한 소명 내용을 작성해 주세요.',
    visibleWhenAll: [{ source: 'context', key: 'hasChildExploitation', values: [true] }],
  },
];

const privacyFields: AppealOpinionField[] = [
  { key: 'information_source', label: '개인정보의 출처 및 취득 경위', type: 'text', helperText: '신고된 개인정보를 어디에서 어떤 방법으로 취득했는지 작성해 주세요.' },
  { key: 'provided_purpose', label: '정보를 제공받은 목적', type: 'text', helperText: '정보를 제공받을 당시 안내받거나 합의한 이용 목적을 작성해 주세요.' },
  {
    key: 'publication_basis',
    label: '게시 근거',
    type: 'select',
    helperText: '신고된 개인정보를 게시한 근거를 선택해 주세요.',
    options: [
      { value: 'subject_consent', label: '정보주체에게 게시 동의를 받음' },
      { value: 'subject_public', label: '정보주체가 직접 공개한 정보를 인용함' },
      { value: 'official_public', label: '법령이나 공식 자료에 공개된 정보를 인용함' },
      { value: 'public_interest', label: '보도·비평·공익적 문제 제기를 위해 게시함' },
      { value: 'other', label: '그 밖의 게시 근거가 있음' },
      { value: 'none', label: '별도의 게시 근거가 없음' },
    ],
  },
  { key: 'publication_basis_details', label: '게시 근거에 대한 설명', type: 'text', helperText: '개인정보를 공개 게시물 또는 댓글에 작성할 수 있다고 판단한 이유와 근거를 작성해 주세요.' },
  {
    key: 'publication_consent',
    label: '게시 동의 여부',
    type: 'select',
    helperText: '개인정보 게시 동의 여부를 선택해 주세요.',
    options: [
      { value: 'same_scope', label: '현재와 같은 범위의 게시에 동의받음' },
      { value: 'partial', label: '일부 정보의 게시에만 동의받음' },
      { value: 'private_only', label: '비공개 전달에만 동의받음' },
      { value: 'not_consented', label: '게시 동의를 받지 않음' },
      { value: 'unknown', label: '게시 동의 여부를 확인할 수 없음' },
    ],
  },
  {
    key: 'publication_consent_basis',
    label: '게시 동의의 범위와 근거',
    type: 'text',
    helperText: '동의받은 개인정보의 종류, 게시 장소, 공개 대상과 공개 기간을 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'publication_consent', values: ['same_scope', 'partial'] }],
  },
  { key: 'publication_purpose', label: '게시 목적', type: 'text', helperText: '신고된 개인정보를 게시물 또는 댓글에 포함한 목적을 작성해 주세요.' },
  { key: 'public_scope', label: '공개 범위', type: 'text', helperText: '신고된 개인정보가 누구에게 어느 기간 동안 공개되도록 설정했는지 작성해 주세요.' },
  {
    key: 'content_maintainability',
    label: '개인정보를 제외하고 내용을 유지할 수 있는지',
    type: 'select',
    helperText: '개인정보를 제외한 나머지 내용을 유지할 수 있는지 선택해 주세요.',
    options: [
      { value: 'remove_information', label: '개인정보를 삭제하고 나머지 내용을 유지할 수 있음' },
      { value: 'mask_information', label: '개인정보 일부를 가리고 나머지 내용을 유지할 수 있음' },
      { value: 'remove_section', label: '개인정보가 포함된 부분 전체를 삭제해야 함' },
      { value: 'cannot_maintain', label: '개인정보를 제외하면 내용을 유지하기 어려움' },
    ],
  },
];

const defamationFields: AppealOpinionField[] = [
  {
    key: 'expression_nature',
    label: '문제가 된 표현의 성격',
    type: 'select',
    helperText: '문제가 된 표현의 성격을 선택해 주세요.',
    options: [
      { value: 'verified_fact', label: '확인한 사실을 기재한 내용' },
      { value: 'opinion', label: '사실을 바탕으로 작성한 의견 또는 평가' },
      { value: 'suspicion', label: '추측이나 의혹을 제기한 내용' },
      { value: 'quotation', label: '다른 사람의 발언이나 자료를 인용한 내용' },
      { value: 'satire', label: '풍자 또는 비유적 표현' },
      { value: 'other', label: '그 밖의 표현' },
    ],
  },
  { key: 'facts_explanation', label: '사실관계에 대한 소명', type: 'text', helperText: '직접 확인한 사실관계와 사건의 진행 경과를 작성해 주세요.' },
  { key: 'source_basis', label: '작성 근거 및 출처', type: 'text', helperText: '작성 당시 확인한 문서, 대화, 직접 경험, 취재 내용과 자료의 출처를 작성해 주세요.' },
  { key: 'fact_check_process', label: '사실 확인 과정', type: 'text', helperText: '작성 전에 사실관계를 확인한 과정을 작성해 주세요.' },
  { key: 'writing_purpose', label: '작성 목적', type: 'text', helperText: '해당 내용을 작성한 목적을 작성해 주세요.' },
  {
    key: 'public_interest_type',
    label: '공공의 이해와 관련된 내용인지',
    type: 'select',
    helperText: '공공의 이해와 관련된 내용인지 선택해 주세요.',
    options: [
      { value: 'public', label: '공공의 이해와 관련된 내용이라고 판단함' },
      { value: 'private', label: '개인적인 분쟁에 관한 내용임' },
      { value: 'both', label: '두 성격이 모두 포함되어 있음' },
      { value: 'not_applicable', label: '해당하지 않음' },
    ],
  },
  {
    key: 'public_interest_reason',
    label: '공공의 이해와 관련된다고 판단한 이유',
    type: 'text',
    helperText: '해당 내용을 공개하는 것이 다수 이용자나 사회적 이해와 관련된다고 판단한 이유를 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'public_interest_type', values: ['public', 'both'] }],
  },
  { key: 'full_context', label: '전체 문맥에 대한 설명', type: 'text', helperText: '문제가 된 표현의 앞뒤 내용과 전체 문맥에서의 의미를 작성해 주세요.' },
  {
    key: 'quotation_type',
    label: '인용 여부',
    type: 'select',
    helperText: '문제가 된 표현의 인용 여부를 선택해 주세요.',
    options: [
      { value: 'direct', label: '직접 작성한 표현' },
      { value: 'quoted', label: '다른 사람의 발언이나 자료를 인용한 표현' },
      { value: 'mixed', label: '직접 작성한 내용과 인용한 내용이 함께 포함됨' },
    ],
  },
  {
    key: 'quotation_source',
    label: '인용 출처와 범위',
    type: 'text',
    helperText: '인용한 사람, 문서, 기사 등의 출처와 인용한 범위를 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'quotation_type', values: ['quoted', 'mixed'] }],
  },
  {
    key: 'modification_intent',
    label: '표현을 수정할 의사',
    type: 'select',
    helperText: '문제가 된 표현을 수정할 의사가 있는지 선택해 주세요.',
    options: [
      { value: 'none', label: '수정할 의사 없음' },
      { value: 'modify', label: '문제가 된 표현을 수정하겠음' },
      { value: 'delete', label: '문제가 된 표현을 삭제하겠음' },
      { value: 'supplement', label: '사실관계를 보완하겠음' },
    ],
  },
];

const personalityRightsFields: AppealOpinionField[] = [
  { key: 'source', label: '자료 또는 정보의 출처', type: 'text', helperText: '신고된 자료 또는 정보를 어디에서 취득했는지 작성해 주세요.' },
  {
    key: 'collector',
    label: '촬영·녹음·수집한 사람',
    type: 'select',
    helperText: '자료 또는 정보를 촬영·녹음·수집한 사람을 선택해 주세요.',
    options: [
      { value: 'appellant', label: '소명자가 직접 촬영·녹음·수집함' },
      { value: 'rights_holder', label: '권리 침해 대상이 직접 제공함' },
      { value: 'third_party', label: '제3자에게 제공받음' },
      { value: 'public_source', label: '공개된 자료에서 취득함' },
      { value: 'unknown', label: '촬영·녹음·수집한 사람을 확인할 수 없음' },
      { value: 'not_applicable', label: '해당 없음' },
    ],
  },
  { key: 'collection_circumstances', label: '촬영·녹음·수집 경위', type: 'text', helperText: '자료나 정보를 촬영·녹음·수집한 장소, 상황과 목적을 작성해 주세요.' },
  {
    key: 'recording_consent',
    label: '촬영·녹음 동의 여부',
    type: 'select',
    helperText: '당사자의 촬영·녹음 동의 여부를 선택해 주세요.',
    options: [
      { value: 'consented', label: '당사자가 촬영·녹음에 동의함' },
      { value: 'partial', label: '일부 촬영·녹음에만 동의함' },
      { value: 'not_consented', label: '촬영·녹음에 동의하지 않음' },
      { value: 'unknown', label: '동의 여부를 확인할 수 없음' },
      { value: 'not_direct', label: '직접 촬영·녹음한 자료가 아님' },
      { value: 'not_applicable', label: '해당 없음' },
    ],
  },
  {
    key: 'recording_consent_basis',
    label: '촬영·녹음 동의의 범위와 근거',
    type: 'text',
    helperText: '당사자가 동의한 촬영·녹음의 범위와 근거를 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'recording_consent', values: ['consented', 'partial'] }],
  },
  {
    key: 'publication_consent',
    label: '게시·공개 동의 여부',
    type: 'select',
    helperText: '당사자의 게시·공개 동의 여부를 선택해 주세요.',
    options: [
      { value: 'same_scope', label: '현재와 같은 범위의 게시·공개에 동의함' },
      { value: 'limited_scope', label: '제한된 범위의 게시·공개에만 동의함' },
      { value: 'not_consented', label: '게시·공개에 동의하지 않음' },
      { value: 'unknown', label: '게시·공개 동의 여부를 확인할 수 없음' },
      { value: 'not_applicable', label: '해당 없음' },
    ],
  },
  {
    key: 'publication_consent_basis',
    label: '게시·공개 동의의 범위와 근거',
    type: 'text',
    helperText: '공개가 허용된 서비스, 공개 대상, 공개 기간과 사용 목적을 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'publication_consent', values: ['same_scope', 'limited_scope'] }],
  },
  { key: 'private_information_source', label: '사생활 정보를 알게 된 경위', type: 'text', helperText: '신고된 사생활 정보를 알게 된 경위를 작성해 주세요.' },
  {
    key: 'publication_basis',
    label: '게시·공개 근거',
    type: 'select',
    helperText: '자료 또는 정보를 게시·공개한 근거를 선택해 주세요.',
    options: [
      { value: 'consent', label: '당사자의 동의를 받음' },
      { value: 'subject_public', label: '당사자가 직접 공개한 자료를 인용함' },
      { value: 'official_public', label: '공식적으로 공개된 자료를 인용함' },
      { value: 'public_interest', label: '보도·비평·공익적 문제 제기를 위해 사용함' },
      { value: 'party_explanation', label: '사건의 당사자로서 사실관계를 설명하기 위해 사용함' },
      { value: 'other', label: '그 밖의 공개 근거가 있음' },
      { value: 'none', label: '별도의 공개 근거가 없음' },
    ],
  },
  { key: 'publication_basis_details', label: '게시·공개 근거에 대한 설명', type: 'text', helperText: '자료 또는 정보를 게시할 수 있다고 판단한 이유를 작성해 주세요.' },
  { key: 'publication_purpose', label: '게시 목적', type: 'text', helperText: '신고된 자료나 정보를 게시물 또는 댓글에 포함한 목적을 작성해 주세요.' },
  { key: 'public_scope', label: '공개 범위', type: 'text', helperText: '자료나 정보가 누구에게 어느 기간 동안 공개되도록 설정했는지 작성해 주세요.' },
  { key: 'identification_need', label: '당사자를 식별할 필요가 있었다고 판단한 이유', type: 'text', helperText: '당사자를 식별할 수 있게 작성해야 했다고 판단한 이유를 작성해 주세요.' },
  {
    key: 'editing_status',
    label: '편집·가공 여부',
    type: 'select',
    helperText: '자료의 편집·가공 여부를 선택해 주세요.',
    options: [
      { value: 'not_edited', label: '편집하거나 가공하지 않음' },
      { value: 'edited', label: '일부 편집하거나 가공함' },
      { value: 'third_party', label: '제3자가 편집한 자료를 게시함' },
      { value: 'unknown', label: '확인할 수 없음' },
    ],
  },
  {
    key: 'editing_scope',
    label: '편집·가공한 범위와 이유',
    type: 'text',
    helperText: '변경한 부분과 변경한 이유를 작성해 주세요.',
    visibleWhenAll: [{ source: 'values', key: 'editing_status', values: ['edited', 'third_party'] }],
  },
  {
    key: 'modification_intent',
    label: '수정할 의사',
    type: 'select',
    helperText: '문제가 된 자료나 정보를 수정할 의사를 선택해 주세요.',
    options: [
      { value: 'none', label: '수정할 의사 없음' },
      { value: 'mask_body', label: '얼굴·신체를 직접 가리겠음' },
      { value: 'alter_voice', label: '음성을 직접 제거하거나 변조하겠음' },
      { value: 'remove_identity', label: '실명·직장 등 신원정보를 직접 삭제하겠음' },
      { value: 'remove_private_information', label: '사생활 정보를 직접 삭제하겠음' },
      { value: 'remove_media', label: '문제가 된 사진·영상·음성 파일을 직접 삭제하겠음' },
      { value: 'remove_section', label: '문제가 된 부분 전체를 직접 삭제하겠음' },
    ],
  },
];

export const appealOpinionFields: Record<ReportAppealCategory, AppealOpinionField[]> = {
  illegal_info: illegalInfoFields,
  illegal_filming: illegalFilmingFields,
  privacy: privacyFields,
  defamation: defamationFields,
  personality_rights: personalityRightsFields,
};

function matchesCondition(
  condition: VisibilityCondition,
  values: Record<string, unknown>,
  context: AppealOpinionContext,
) {
  const source = condition.source === 'values' ? values : context;
  return condition.values.includes(source[condition.key] as string | boolean);
}

export function isAppealOpinionFieldVisible(
  field: AppealOpinionField,
  values: Record<string, unknown>,
  context: AppealOpinionContext,
) {
  if (field.visibleWhenAll?.some((condition) => !matchesCondition(condition, values, context))) {
    return false;
  }

  if (field.visibleWhenAny && !field.visibleWhenAny.some((condition) => matchesCondition(condition, values, context))) {
    return false;
  }

  return true;
}

export function getAppealOpinionValueLabel(field: AppealOpinionField, value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return field.options?.find((option) => option.value === value)?.label ?? value;
}
