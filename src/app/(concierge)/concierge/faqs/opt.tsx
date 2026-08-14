'use client';

import { useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material';
import styles from '@/app/concierge.module.sass';

type Faq = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
};

export type FaqCategory = {
  id: string;
  name: string;
  sortOrder: number;
  faqs: Faq[];
};

type FaqsProps = {
  categories: FaqCategory[];
};

export default function Faqs({ categories }: FaqsProps) {
  const [currentCategoryId, setCurrentCategoryId] = useState(categories[0]?.id ?? '');
  const currentCategory = categories.find((category) => category.id === currentCategoryId) ?? categories[0];

  return (
    <>
      <ul className={styles['faq-categories']}>
        {categories.map((category) => {
          const isCurrent = category.id === currentCategory?.id;

          return (
            <li key={category.id}>
              <button
                type="button"
                className={isCurrent ? styles.current : undefined}
                aria-pressed={isCurrent}
                onClick={() => setCurrentCategoryId(category.id)}
              >
                {category.name}
              </button>
            </li>
          );
        })}
      </ul>

      {currentCategory ? (
        <div className={`paper ${styles.Accordion} ${styles['faq-list']}`}>
          {currentCategory.faqs.map((faq) => (
            <Accordion key={faq.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">{faq.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={1}>
                  {faq.answer.split('\n').map((paragraph, index) => (
                    <Typography key={`${faq.id}-${index}`} variant="body2">
                      {paragraph}
                    </Typography>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </div>
      ) : null}
    </>
  );
}
