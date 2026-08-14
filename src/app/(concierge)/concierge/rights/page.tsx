import React from 'react';
import { Metadata } from 'next';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionActions, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material';
import { originTitle, Seo } from '@/lib/seo';
import Anchor from '@/components/Anchor';
import Container from '../menu';
import styles from '@/app/concierge.module.sass';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `권리보호센터 - ${originTitle}`,
    pageTitle: `권리보호센터`,
    pageDescription: `데브허브 고객센터`,
    pageImg: `https://velhub.xyz/og-etc.webp?ts=${timestamp}`,
    pagePath: '/concierge/rights',
  });
}

export default function Page() {
  const id = React.useId();

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>권리보호센터</h1>
          <div className={`paper ${styles.Accordion}`}>
            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${id}-panel1-content`}
                id={`${id}-panel1-header`}
              >
                <Typography variant="subtitle2">
                  나에 대한 명예훼손 내용이 포함된 게시물을 발견했는데 어떻게 신고하나요?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={3}>
                  <Typography variant="body2">
                    데브허브에 등록된 게시물에 본인의 명예를 훼손하는 내용이 포함된 경우 권리 침해 신고를 통해 해당
                    게시물에 대한 게시 중단을 요청할 수 있습니다.
                  </Typography>
                  <Typography variant="body2">
                    권리보호센터의 권리 침해 신고 페이지로 접속하여 본인인증 절차 후 신고해 주세요.
                  </Typography>
                  <Typography variant="body2">
                    명예훼손 사유로 신고를 접수하는 경우 구체적인 명예훼손에 대한 소명 내용을 함께 제출해 주세요.
                  </Typography>
                </Stack>
              </AccordionDetails>
              <AccordionActions className={styles.AccordionActions}>
                <Anchor href="/concierge/rights/inquery" className="button medium action">
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
                <Typography variant="subtitle2">
                  나의 동의 없이 사진·사생활 등이 포함된 게시물을 발견했는데 어떻게 신고하나요?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={3}>
                  <Typography variant="body2">
                    데브허브에 등록된 게시물에 본인의 동의 없이 초상권을 침해하는 사진이 포함되어 있거나 구체적인 사생활
                    정보가 포함된 경우 권리 침해 신고를 통해 해당 게시물에 대한 게시 중단을 요청할 수 있습니다.
                  </Typography>
                  <Typography variant="body2">
                    권리보호센터의 권리 침해 신고 페이지로 접속하여 본인인증 절차 후 신고해 주세요.
                  </Typography>
                  <Typography variant="body2">
                    초상권·사생활 침해 등 인격권 사유로 신고를 접수하는 경우 구체적인 초상권 또는 본인임을 확인할 수
                    있는 증빙자료를 함께 제출해 주세요.
                  </Typography>
                </Stack>
              </AccordionDetails>
              <AccordionActions className={styles.AccordionActions}>
                <Anchor href="/concierge/rights/inquery" className="button medium action">
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
                <Typography variant="subtitle2">명예훼손·인격권 침해로 신고 가능한 대상은 무엇인가요?</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={3}>
                  <Typography variant="body2">
                    데브허브에 등록된 게시물로 인해 명예를 훼손당했다고 생각되거나 초상권·사생활 침해가 발생한 경우 권리
                    침해 신고를 접수할 수 있습니다.
                  </Typography>
                  <Typography variant="body2">
                    이때 조치 가능한 게시물은 커뮤니티, 블로그 등 다른 이용자가 작성한 게시물로 한정됩니다.
                  </Typography>
                </Stack>
              </AccordionDetails>
              <AccordionActions className={styles.AccordionActions}>
                <Anchor href="/concierge/rights/inquery" className="button medium action">
                  신고하기
                </Anchor>
              </AccordionActions>
            </Accordion>

            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${id}-panel4-content`}
                id={`${id}-panel4-header`}
              >
                <Typography variant="subtitle2">명예훼손·인격권 침해 신고 시 필요한 서류는 무엇인가요?</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={3}>
                  <Typography variant="body2">
                    신고자가 단체인 경우 해당 단체 정보를 확인할 수 있는 사업자등록증 또는 법인등록증 사본을 준비해
                    주세요.
                  </Typography>
                  <Typography variant="body2">
                    본인이 아닌 대리인을 통해 신고를 접수하는 경우 단체는 단체 직인이나 대표의 서명, 개인은 신고자의
                    서명이 날인된 위임장을 함께 제출해 주세요.
                  </Typography>
                </Stack>
              </AccordionDetails>
              <AccordionActions className={styles.AccordionActions}>
                <Anchor href="/concierge/rights/inquery" className="button medium action">
                  신고하기
                </Anchor>
              </AccordionActions>
            </Accordion>

            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${id}-panel5-content`}
                id={`${id}-panel5-header`}
              >
                <Typography variant="subtitle2">명예훼손·인격권 침해 신고 시 처리 과정은 어떻게 되나요?</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={3}>
                  <Typography variant="body2">
                    명예훼손·인격권 침해로 권리 침해 신고가 접수된 커뮤니티, 블로그 등 게시물의 처리 과정은 아래와
                    같습니다.
                  </Typography>
                  <Stack gap={1}>
                    <Typography variant="body2">
                      1. 게시 중단 조치 시 게시물 작성자에게 게시 중단 요청 사유와 함께 요청자 관련 정보가 안내됩니다.
                    </Typography>
                    <Typography variant="body2">
                      2. 게시물 작성자는 이의신청을 할 수 있으며, 이때 게시 중단 요청자에게 관련 내용이 안내됩니다.
                    </Typography>
                    <Typography variant="body2">
                      3. 이의신청 검토가 완료되면 게시 중단 조치 30일 뒤 게시물이 복원됩니다.
                    </Typography>
                    <Typography variant="body2">4. 복원된 게시물은 다시 게시 중단될 수 없습니다.</Typography>
                  </Stack>
                  <Typography variant="body2">
                    추가로 게시물 조치가 필요한 경우 방송미디어통신심의위원회로 심의를 신청할 수 있습니다.
                  </Typography>
                  <Stack gap={1}>
                    <Typography variant="body2">
                      5. 방송미디어통신심의위원회의 심의 결과에 따라 게시물은 다시 조치될 수 있습니다.
                    </Typography>
                    <Typography variant="body2">
                      6. 자세한 심의 과정은 방송미디어통신심의위원회의 관련 부서로 문의해 주세요.
                    </Typography>
                  </Stack>
                </Stack>
              </AccordionDetails>
              <AccordionActions className={styles.AccordionActions}>
                <Anchor href="/concierge/rights/inquery" className="button medium action">
                  신고하기
                </Anchor>
              </AccordionActions>
            </Accordion>

            <Accordion>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${id}-panel6-content`}
                id={`${id}-panel6-header`}
              >
                <Typography variant="subtitle2">신고가 반려되는 사유는 무엇인가요?</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={3}>
                  <Typography variant="body2">
                    권리 침해 신고 접수 시 자주 반려되는 대표적인 유형과 그 사유를 안내해 드립니다.
                  </Typography>
                  <Typography variant="body2">원활한 신고 처리를 위해 접수 전 아래 내용을 확인해 주세요.</Typography>

                  <Stack gap={1}>
                    <Typography variant="body2">■ 구체적인 피해 사실이 설명되지 않은 경우</Typography>
                    <Typography variant="body2">
                      단순히 기분이 나쁘거나 게시물을 삭제해 달라는 요청만으로는 해당 게시물의 게시 중단 가능 여부를
                      판단하기 어렵습니다.
                    </Typography>
                    <Typography variant="body2">
                      어떤 문구나 이미지가 신고자의 권리를 침해했는지, 구체적으로 어떤 피해가 발생했는지에 대한 설명이
                      부족한 경우 신고가 반려됩니다.
                    </Typography>
                    <Typography variant="body2">문제가 된 구체적인 문구나 대목을 명시해 주세요.</Typography>
                    <Typography variant="body2">
                      해당 게시물이 누구의 어떠한 권리를 침해했는지 구체적으로 작성해 주세요.
                    </Typography>
                  </Stack>

                  <Stack gap={1}>
                    <Typography variant="body2">■ 신고자 또는 피해자를 게시물에서 확인하기 어려운 경우</Typography>
                    <Typography variant="body2">
                      권리 침해 신고는 권리를 침해당한 대상자를 확인할 수 있어야 합니다. 일반적으로 제3자가 보더라도
                      해당 게시물이 누구를 지칭하는지 알 수 있어야 합니다.
                    </Typography>
                    <Typography variant="body2">
                      닉네임, 실명, 사진 등이 언급되지 않아 게시물의 대상이 누구인지 객관적으로 식별할 수 없는 경우 피해
                      대상 불분명으로 신고가 반려됩니다.
                    </Typography>
                    <Typography variant="body2">
                      게시물에 본인을 식별할 수 있는 이름, 사진, 연락처 등의 정보가 포함되어 있는지 확인해 주세요.
                    </Typography>
                    <Typography variant="body2">
                      직접적인 언급이 없더라도 전후 맥락상 본인임을 충분히 확인할 수 있는 증빙자료를 함께 제출해 주세요.
                    </Typography>
                  </Stack>

                  <Stack gap={1}>
                    <Typography variant="body2">■ 신고 기준에 부합하지 않는 경우</Typography>
                    <Typography variant="body2">
                      상품 후기 등의 경우 주관적인 만족도나 정당한 비판은 신고 대상이 되지 않을 수 있습니다.
                    </Typography>
                    <Typography variant="body2">
                      상품에 대한 후기가 개인의 경험에 기반한 주관적인 후기이며 허위사실을 포함했거나 비방의 목적이
                      명확하지 않은 경우 처리가 어렵습니다.
                    </Typography>
                    <Typography variant="body2">
                      사실관계에 기반하여 다른 이용자에게 정보를 제공하려는 목적이 크다고 판단되는 경우 권리 침해로 보기
                      어렵습니다.
                    </Typography>
                    <Typography variant="body2">
                      허위 사실을 유포하여 고의적으로 영업을 방해하거나 근거 없는 비하 표현을 사용한 경우에는 신고할 수
                      있으므로 해당 내용과 피해 사실을 구체적으로 작성해 주세요.
                    </Typography>
                  </Stack>
                </Stack>
              </AccordionDetails>
              <AccordionActions className={styles.AccordionActions}>
                <Anchor href="/concierge/rights/inquery" className="button medium action">
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
