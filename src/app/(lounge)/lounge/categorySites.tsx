'use client';

import { useState } from 'react';
import type { CategoryRisingSiteGroup } from '@/lib/service/lounge/loungeMoments';
import Slick from './slick';
import styles from '@/app/page.module.sass';

export default function CategorySites({ groups }: { groups: CategoryRisingSiteGroup[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? 0);
  const selectedGroup = groups.find((group) => group.id === groupId) ?? groups[0];
  const [categoryId, setCategoryId] = useState(selectedGroup?.categories[0]?.id ?? 0);
  const selectedCategory =
    selectedGroup?.categories.find((category) => category.id === categoryId) ?? selectedGroup?.categories[0];

  if (!selectedGroup || !selectedCategory) {
    return null;
  }

  function selectGroup(nextGroupId: number) {
    const nextGroup = groups.find((group) => group.id === nextGroupId);
    setGroupId(nextGroupId);
    setCategoryId(nextGroup?.categories[0]?.id ?? 0);
  }

  return (
    <section className={styles['category-sites']}>
      <h2>주제별 사이트</h2>
      <div className={styles['category-tabs']}>
        <ul className={styles['category-groups']}>
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className={group.id === selectedGroup.id ? styles.current : undefined}
                onClick={() => selectGroup(group.id)}
              >
                {group.label}
              </button>
            </li>
          ))}
        </ul>
        <ul className={styles['category-items']}>
          {selectedGroup.categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                className={category.id === selectedCategory.id ? styles.current : undefined}
                onClick={() => setCategoryId(category.id)}
              >
                {category.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Slick key={selectedCategory.id} sitesHitsData={{ sites: selectedCategory.sites }} />
    </section>
  );
}
