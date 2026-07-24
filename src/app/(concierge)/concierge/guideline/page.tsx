import React from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  guidelineReportItemsByTargetType,
  isGuidelineReportCategory,
  type ReportTargetType,
} from '@/lib/reports/guidelines';
import Container from '../menu';
import styles from '@/app/concierge.module.sass';

const targetSections: { targetType: ReportTargetType; label: string }[] = [
  { targetType: 'site', label: '사이트' },
  { targetType: 'board', label: '게시판' },
  { targetType: 'post', label: '게시물' },
  { targetType: 'comment', label: '댓글' },
];

export default function Page() {
  const id = React.useId();
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Stack gap={4}>
            {targetSections.map(({ targetType, label }) => {
              const items = guidelineReportItemsByTargetType[targetType].filter((item) =>
                isGuidelineReportCategory(item.value),
              );
              return (
                <section key={targetType}>
                  <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                    {label}
                  </Typography>
                  <div className={`paper ${styles.Accordion}`}>
                    {items.map((item) => (
                      <Accordion key={item.value}>
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          aria-controls={`${id}-${targetType}-${item.value}-content`}
                          id={`${id}-${targetType}-${item.value}-header`}
                        >
                          <Typography variant="subtitle2">{item.title}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack gap={1}>
                            {item.descriptions.map((description) => (
                              <Typography key={description} variant="body2">
                                - {description}
                              </Typography>
                            ))}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </div>
                </section>
              );
            })}
          </Stack>
        </div>
      </div>
    </Container>
  );
}
