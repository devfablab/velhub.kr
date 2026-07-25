import React from 'react';
import { Accordion, AccordionActions, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Anchor from '@/components/Anchor';
import Container from '../menu';
import styles from '@/app/concierge.module.sass';

export default function Page() {
  const id = React.useId();
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>신고센터</h1>
          <div className={`paper ${styles.Accordion}`}>
            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${id}-panel1-content`}
                id={`${id}-panel1-header`}
              >
                <Typography variant="subtitle2">정보통신망법에 따른 불법정보/허위조작정보</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={3}>
                  <Typography variant="body2">
                    불법정보/허위조작정보 등에는 다음과 같은 게시물이 있고, 그 자세한 내용은 정보통신망 이용촉진 및
                    정보보호 등에 관한 법률 제44조의7 각 호에서 확인하실 수 있습니다.
                  </Typography>
                  <Stack gap={1}>
                    <Typography variant="body2">■ 불법정보</Typography>
                    <Typography variant="body2">
                      1. 음란한 부호·문언·음향·화상 또는 영상을 배포·판매·임대하거나 공공연하게 전시하는 내용의 정보
                    </Typography>
                    <Typography variant="body2">
                      2-1. 사람을 비방할 목적으로 공공연하게 거짓의 사실을 드러내어 타인의 명예를 훼손하는 내용의 정보
                    </Typography>
                    <Typography variant="body2">
                      2-2. 공공연하게 인종, 국가, 지역, 성별, 장애, 연령, 사회적 신분, 소득수준 또는 재산상태를 이유로
                      특정 개인이나 집단(해당 집단에 소속된 개인을 포함한다. 이하 이 호에서 같다)에 대한 다음 각 목의
                      어느 하나에 해당하는 내용의 정보
                    </Typography>
                    <Stack gap={1} sx={{ pl: 2 }}>
                      <Typography variant="body2">가. 직접적인 폭력이나 차별을 선동하는 정보</Typography>
                      <Typography variant="body2">
                        나. 증오심을 심각하게 조장하여 특정 개인이나 집단의 인간으로서의 존엄성을 현저히 훼손하는 정보
                      </Typography>
                    </Stack>
                    <Typography variant="body2">
                      3. 공포심이나 불안감을 유발하는 부호·문언·음향·화상 또는 영상을 반복적으로 상대방에게 도달하도록
                      하는 내용의 정보
                    </Typography>
                    <Typography variant="body2">
                      4. 정당한 사유 없이 정보통신시스템, 데이터 또는 프로그램 등을 훼손·멸실·변경·위조하거나 그 운용을
                      방해하는 내용의 정보
                    </Typography>
                    <Typography variant="body2">
                      5. 「청소년 보호법」에 따른 청소년유해매체물로서 상대방의 연령 확인, 표시의무 등 법령에 따른
                      의무를 이행하지 아니하고 영리를 목적으로 제공하는 내용의 정보
                    </Typography>
                    <Typography variant="body2">6-1. 법령에 따라 금지되는 사행행위에 해당하는 내용의 정보</Typography>
                    <Typography variant="body2">
                      6-2. 이 법 또는 개인정보 보호에 관한 법령을 위반하여 개인정보를 거래하는 내용의 정보
                    </Typography>
                    <Typography variant="body2">
                      6-3. 총포·화약류(생명·신체에 위해를 끼칠 수 있는 폭발력을 가진 물건을 포함한다)를 제조할 수 있는
                      방법이나 설계도 등의 정보
                    </Typography>
                    <Typography variant="body2">
                      6-4. 「마약류 관리에 관한 법률」에서 금지하는 마약류의 사용, 제조, 매매 또는 매매의 알선 등에
                      해당하는 내용의 정보
                    </Typography>
                    <Typography variant="body2">
                      7. 법령에 따라 분류된 비밀 등 국가기밀을 누설하는 내용의 정보
                    </Typography>
                    <Typography variant="body2">8. 「국가보안법」에서 금지하는 행위를 수행하는 내용의 정보</Typography>
                    <Typography variant="body2">
                      9. 그 밖에 범죄를 목적으로 하거나 교사(敎唆) 또는 방조하는 내용의 정보
                    </Typography>
                  </Stack>
                  <Stack gap={1}>
                    <Typography variant="body2">■ 허위조작정보</Typography>
                    <Typography variant="body2">
                      다음 각 호에 해당한다는 사실을 알았음에도 손해를 끼칠 의도 또는 부당한 이익을 얻을 목적으로 타인의
                      인격권이나 재산권 또는 공공의 이익을 침해하는 다음 각 호의 허위조작정보를 유통하는 경우. 다만
                      풍자와 패러디는 제외
                    </Typography>
                    <Typography variant="body2">
                      1. 내용의 전부 또는 일부가 허위인 정보(이하 “허위정보”라 한다)
                    </Typography>
                    <Typography variant="body2">
                      2. 내용을 사실로 오인하도록 변형된 정보(이하 “조작정보”라 한다)
                    </Typography>
                  </Stack>
                </Stack>
              </AccordionDetails>
              <AccordionActions>
                <Anchor href="/concierge/help/inquery" className="button medium action">
                  신고하기
                </Anchor>
              </AccordionActions>
            </Accordion>
            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${id}-panel2-content`}
                id={`${id}-panel2-header`}
              >
                <Typography variant="subtitle2">불법촬영물</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={3}>
                  <Typography variant="body2">
                    불법촬영물이란 불법성 게시물의 일종으로, 특히 성폭력범죄의 처벌 등에 관한 특례법(약칭:
                    성폭력처벌법)과 아동·청소년의 성보호에 관한 법률(약칭: 청소년성보호법)에서 제작과 유통을 금지하고
                    있는 사진, 동영상 등의 게시물을 말합니다.
                  </Typography>
                  <Typography variant="body2">
                    불법촬영물 등이 유통될 경우 불법촬영물 등의 대상이 된 당사자에겐 중대한 피해가 발생할 수 있기
                    때문에, 전기통신사업법 및 정보통신망 이용촉진 및 정보보호 등에 관한 법률(약칭: 정보통신망법)은
                    사업자들에게 신고 등을 받아 불법촬영물 등의 유통 방지에 필요한 조치를 취하도록 하고 있습니다.
                  </Typography>
                  <Typography variant="body2">
                    불법촬영물 등에는 다음과 같은 게시물이 있고, 그 자세한 내용은 전기통신사업법 제22조의 5 제1항 각 호
                    및 정보통신망법 제44조의 9 제1항 각 호에서 확인하실 수 있습니다.
                  </Typography>
                  <Stack gap={1}>
                    <Typography variant="body2">■ 불법촬영물</Typography>
                    <Typography variant="body2">
                      1. 성적 욕망 또는 수치심을 유발할 수 있는 사람의 신체를 촬영대상자의 의사에 반하여 촬영한 것
                    </Typography>
                    <Typography variant="body2">
                      2. 촬영 당시에는 촬영 대상자의 의사(자신의 신체를 직접 촬영한 경우를 포함)에 반하지 않았어도
                      사후에 촬영 대상자의 의사에 반하여 유통된 촬영물
                    </Typography>
                  </Stack>
                  <Stack gap={1}>
                    <Typography variant="body2">■ 허위 영상물</Typography>
                    <Typography variant="body2">
                      1. 유통할 목적으로 사람의 얼굴·신체 또는 음성을 대상으로 한 촬영물·영상물 또는 음성물을 그
                      대상자의 의사에 반하여 성적 욕망 또는 수치심을 유발할 수 있는 형태로 편집·합성 또는 가공한 것
                    </Typography>
                    <Typography variant="body2">
                      2. 편집·합성 또는 가공할 당시에는 그 대상자의 의사에 반하지 아니한 경우에도 사후에 그 대상자의
                      의사에 반하여 유통된 촬영물·영상물 또는 음성물
                    </Typography>
                  </Stack>
                  <Stack gap={1}>
                    <Typography variant="body2">■ 아동·청소년성착취물</Typography>
                    <Typography variant="body2">
                      아동·청소년 또는 아동·청소년으로 명백하게 인식될 수 있는 사람이나 표현물이 등장하여 성교 등 성적
                      행위(아동·청소년의 신체의 전부 또는 일부를 접촉·노출하는 행위로서 일반인의 성적 수치심이나
                      혐오감을 일으키는 행위도 포함)를 하는 내용이 표현된 것
                    </Typography>
                  </Stack>
                  <Typography variant="body2">
                    데브허브는 불법촬영물등이 포함된 게시물에 대한 신고가 접수된 경우 최대한 빠르고 정확하게 조치하고자
                    노력하고 있습니다.
                  </Typography>
                  <Typography variant="body2">
                    만약 신고 접수된 게시물의 불법촬영물등 여부를 판단하기 어려운 경우, 데브허브는 접수된 신고 내용을
                    방송미디어통신심의위원회에 심의를 요청할 수 있으며 방송미디어통신심의위원회의 심의 결정에 따라
                    조치하게 되며, 심의 결과가 확인되는 대로 신속하게 조치할 예정입니다.
                  </Typography>
                  <Typography variant="body2">
                    만일 위에 해당하는 불법촬영물등을 발견하셨다면 데브허브 신고센터를 통해 신고하실 수 있으며, 아울러
                    방송미디어통신심의위원회의 디지털 성범죄 신고 페이지를 통해서도 신고 제출이 가능합니다.
                  </Typography>
                  <Typography variant="body2">
                    <Anchor
                      className="link-external"
                      href="https://www.kocsc.or.kr/sec/rnc/iPinCert.do?conText=%2Fmain&joinType=24&explain=true"
                    >
                      디지털 성범죄 신고 바로가기
                    </Anchor>
                  </Typography>
                  <Stack gap={1}>
                    <Typography variant="body2">상세한 내용은 관련 법률을 참고해 주시기 바랍니다.</Typography>
                    <Typography variant="body2">
                      <Anchor
                        className="link-external"
                        href="https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EC%A0%84%EA%B8%B0%ED%86%B5%EC%8B%A0%EC%82%AC%EC%97%85%EB%B2%95/%2820201210%2C17352%2C20200609%29/%25EC%25A0%259C22%25EC%25A1%25B0%25EC%259D%25985"
                      >
                        전기통신사업법 제22조의5(부가통신사업자의 불법촬영물 등 유통 방지) 제1항 바로가기
                      </Anchor>
                    </Typography>
                    <Typography variant="body2">
                      <Anchor
                        className="link-external"
                        href="https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EC%A0%95%EB%B3%B4%ED%86%B5%EC%8B%A0%EB%A7%9D%EC%9D%B4%EC%9A%A9%EC%B4%89%EC%A7%84%EB%B0%8F%EC%A0%95%EB%B3%B4%EB%B3%B4%ED%98%B8%EB%93%B1%EC%97%90%EA%B4%80%ED%95%9C%EB%B2%95%EB%A5%A0/%2820201210%2C17358%2C20200609%29/%25EC%25A0%259C44%25EC%25A1%25B0%25EC%259D%25989"
                      >
                        정보통신망법 제44조의9(불법촬영물등 유통 방지 책임자) 제1항 바로가기
                      </Anchor>
                    </Typography>
                  </Stack>
                </Stack>
              </AccordionDetails>
              <AccordionActions>
                <Anchor href="/concierge/help/inquery" className="button medium action">
                  신고하기
                </Anchor>
              </AccordionActions>
            </Accordion>
            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${id}-panel3-content`}
                id={`${id}-panel3-header`}
              >
                <Typography variant="subtitle2">개인정보 노출 게시물</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={3}>
                  <Typography variant="body2">
                    개인정보는 생존하는 개인에 관한 정보로서 단독 또는 두 가지 이상의 정보를 결합하여 특정 개인을 인지할
                    수 있는 정보입니다.
                  </Typography>
                  <Typography variant="body2">
                    ​개인정보가 노출되면 스팸, 보이스피싱, 주민등록번호도용 등의 불법행위에 악용되거나 사생활 침해의
                    피해가 발생할 우려가 있습니다.
                  </Typography>
                  <Typography variant="body2">
                    ​이에 데브허브는 게시물을 제한하여 개인정보가 노출되지 않도록 노력할 의무가 있습니다.
                  </Typography>
                  <Stack gap={1}>
                    <Typography variant="body2">
                      데브허브에서 제한하고 있는 개인정보노출 게시물의 대표적인 대상은 아래와 같습니다.
                    </Typography>
                    <Typography variant="body2">
                      - 주민등록번호, 여권번호, 운전면허증 등 법적으로 중요한 타인의 개인 정보를 게재하는 경우
                    </Typography>
                    <Typography variant="body2">
                      - 생년월일, 학교명, 직장명, 이메일 주소, 자택 주소 등 충분히 특정 개인을 인지할 수 있는 정보를
                      당사자 동의 없이 게재하는 경우
                    </Typography>
                  </Stack>
                  <Typography variant="body2">
                    만약, 본인의 개인정보가 데브허브에서 노출되고 있다면 신고센터를 통해 신고해 주시기 바랍니다.
                  </Typography>
                  <Typography variant="body2">
                    제한하는 게시물의 상세 유형은 서비스 특성에 따라 다를 수 있습니다.
                  </Typography>
                  <Typography variant="body2">
                    ​상세한 내용은 관련 법률 및 개별 서비스 상의 운영원칙을 확인해 주세요.
                  </Typography>
                  <Typography variant="body2">
                    <Anchor
                      className="link-external"
                      href="http://likms.assembly.go.kr/law/lawsLawtInqyDetl1010.do?mappingId=%2FlawsLawtInqyDetl1010.do&genActiontypeCd=2ACT1010&genDoctreattypeCd=DOCT2004&contId=1986051200000001&contSid=0028&cachePreid=ALL&genMenuId=menu_serv_nlaw_lawt_1010&viewGb=PROM"
                    >
                      정보통신망 이용촉진 및 정보보호 등에 관한 법률 바로가기
                    </Anchor>
                  </Typography>
                </Stack>
              </AccordionDetails>
              <AccordionActions>
                <Anchor href="/concierge/help/inquery" className="button medium action">
                  신고하기
                </Anchor>
              </AccordionActions>
            </Accordion>
          </div>
        </div>
      </div>
    </Container>
  );
}
