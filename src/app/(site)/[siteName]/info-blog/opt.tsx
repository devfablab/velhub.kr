'use client';

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDate } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/blogInfo.module.sass';

type SiteInfo = {
  created_at: string;
  site_key: string;
  site_label: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  summary: string | null;
  site_type: string;
  visibility_type: string;
  theme_type: string;
  is_shutdown: boolean;
};

type MemberGeneral = {
  id: string;
  created_at: string;
  name_ko: string | null;
  name_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  start_work_date: string | null;
  job: string | null;
  member_id: string;
  site_id: string;
  nickname: string;
  isMine: boolean;
};

type MemberEducation = {
  id: string;
  created_at: string;
  school: string;
  major: string | null;
  start_date: string | null;
  end_date: string | null;
  member_id: string;
  site_id: string;
  sort_order: number;
  nickname: string;
  isMine: boolean;
};

type MemberAward = {
  id: string;
  created_at: string;
  subject: string;
  institution: string;
  date_time: string | null;
  member_id: string;
  site_id: string;
  sort_order: number;
  nickname: string;
  isMine: boolean;
};

type MemberProject = {
  id: string;
  created_at: string;
  work_start_date: string | null;
  work_end_date: string | null;
  subject: string;
  description: string | null;
  client: string | null;
  agency: string | null;
  site_name: string | null;
  site_url: string | null;
  member_id: string;
  site_id: string;
  sort_order: number;
  nickname: string;
  isMine: boolean;
};

type MemberCareer = {
  id: string;
  created_at: string;
  organization: string;
  team_position: string;
  role_job: string;
  work_start_date: string | null;
  work_end_date: string | null;
  member_id: string;
  site_id: string;
  sort_order: number;
  nickname: string;
  isMine: boolean;
};

type ItemType = 'educations' | 'awards' | 'projects' | 'careers';

type TeamBlogItem = MemberEducation | MemberAward | MemberProject | MemberCareer;

type TeamBlogItemResponse = {
  ok?: boolean;
  item?: TeamBlogItem;
  error?: string;
};

type MemberGeneralResponse = {
  ok?: boolean;
  memberGeneral?: Omit<MemberGeneral, 'nickname' | 'isMine'>;
  error?: string;
};

type NicknameResponse = {
  ok?: boolean;
  member?: {
    id: string;
    nickname: string;
  };
  error?: string;
};

type FavoriteResponse = {
  ok?: boolean;
  isLoggedIn?: boolean;
  isFavorited?: boolean;
  favoriteCount?: number;
  error?: string;
};

type Props = {
  siteName: string;
  siteInfo: SiteInfo;
  memberGeneral: MemberGeneral[];
  memberEducations: MemberEducation[];
  memberAwards: MemberAward[];
  memberProjects: MemberProject[];
  memberCareers: MemberCareer[];
  canEditMyMemberGeneral: boolean;
};

type GeneralFormValue = {
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  startWorkDate: string;
  job: string;
};

type ItemFormValue = {
  school: string;
  major: string;
  startDate: string;
  endDate: string;
  subject: string;
  institution: string;
  dateTime: string;
  description: string;
  client: string;
  agency: string;
  siteNameValue: string;
  siteUrl: string;
  organization: string;
  teamPosition: string;
  roleJob: string;
  workStartDate: string;
  workEndDate: string;
};

type SortableItemProps = {
  id: string;
  children: ReactNode;
};

function getSiteTypeLabel(siteType: string) {
  if (siteType === 'blog') {
    return '블로그';
  }

  if (siteType === 'community') {
    return '커뮤니티';
  }

  return siteType;
}

function createEmptyGeneralFormValue(): GeneralFormValue {
  return {
    nameKo: '',
    nameEn: '',
    descriptionKo: '',
    descriptionEn: '',
    startWorkDate: '',
    job: '',
  };
}

function createEmptyItemFormValue(): ItemFormValue {
  return {
    school: '',
    major: '',
    startDate: '',
    endDate: '',
    subject: '',
    institution: '',
    dateTime: '',
    description: '',
    client: '',
    agency: '',
    siteNameValue: '',
    siteUrl: '',
    organization: '',
    teamPosition: '',
    roleJob: '',
    workStartDate: '',
    workEndDate: '',
  };
}

function toDateValue(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toInputDateValue(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

function toPayloadDate(value: Date | null) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString().slice(0, 10) : '';
}

function isEducation(item: TeamBlogItem): item is MemberEducation {
  return 'school' in item;
}

function isAward(item: TeamBlogItem): item is MemberAward {
  return 'institution' in item;
}

function isProject(item: TeamBlogItem): item is MemberProject {
  return 'client' in item || 'agency' in item || 'site_url' in item;
}

function getItemTypeLabel(itemType: ItemType) {
  if (itemType === 'educations') {
    return '학력';
  }

  if (itemType === 'awards') {
    return '수상';
  }

  if (itemType === 'projects') {
    return '프로젝트';
  }

  return '경력';
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
  });

  return (
    <div
      className={styles.dnd}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          display: 'flex',
          cursor: 'grab',
          width: 'fit-content',
        }}
      >
        <DragIndicatorIcon sx={{ width: 18, height: 18 }} />
      </Box>

      {children}
    </div>
  );
}

export default function Opt({
  siteName,
  siteInfo,
  memberGeneral,
  memberEducations,
  memberAwards,
  memberProjects,
  memberCareers,
  canEditMyMemberGeneral,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  const siteLabel = siteInfo.site_label ?? siteInfo.site_key;
  const initialMyMemberGeneral = memberGeneral.find((member) => member.isMine) ?? null;

  const [members, setMembers] = useState<MemberGeneral[]>(memberGeneral);
  const [educations, setEducations] = useState<MemberEducation[]>(memberEducations);
  const [awards, setAwards] = useState<MemberAward[]>(memberAwards);
  const [projects, setProjects] = useState<MemberProject[]>(memberProjects);
  const [careers, setCareers] = useState<MemberCareer[]>(memberCareers);

  const [isGeneralDialogOpen, setIsGeneralDialogOpen] = useState(false);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);
  const [itemManageDialogType, setItemManageDialogType] = useState<ItemType | null>(null);
  const [itemFormDialogType, setItemFormDialogType] = useState<ItemType | null>(null);
  const [editingItem, setEditingItem] = useState<TeamBlogItem | null>(null);

  const [generalFormValue, setGeneralFormValue] = useState(createEmptyGeneralFormValue());
  const [itemFormValue, setItemFormValue] = useState(createEmptyItemFormValue());
  const [nicknameValue, setNicknameValue] = useState(initialMyMemberGeneral?.nickname ?? '');

  const [errorMessage, setErrorMessage] = useState('');
  const [nicknameErrorMessage, setNicknameErrorMessage] = useState('');
  const [itemErrorMessage, setItemErrorMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNicknameSubmitting, setIsNicknameSubmitting] = useState(false);
  const [isItemSubmitting, setIsItemSubmitting] = useState(false);

  const [isFavoriteLoaded, setIsFavoriteLoaded] = useState(false);
  const [isFavoriteLoggedIn, setIsFavoriteLoggedIn] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isFavoriteSubmitting, setIsFavoriteSubmitting] = useState(false);
  const [favoriteErrorMessage, setFavoriteErrorMessage] = useState('');
  const [isFavoriteErrorDialogOpen, setIsFavoriteErrorDialogOpen] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  async function loadFavoriteStatus() {
    try {
      setFavoriteErrorMessage('');

      const response = await fetch(`/api/site/blog/${siteName}/favorites`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as FavoriteResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '즐겨찾기 정보를 불러오지 못했습니다.');
      }

      setIsFavoriteLoggedIn(result.isLoggedIn === true);
      setIsFavorited(result.isFavorited === true);
      setFavoriteCount(typeof result.favoriteCount === 'number' ? result.favoriteCount : 0);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setFavoriteErrorMessage(unknownError.message || '즐겨찾기 정보를 불러오지 못했습니다.');
      } else {
        setFavoriteErrorMessage('즐겨찾기 정보를 불러오지 못했습니다.');
      }

      setIsFavoriteErrorDialogOpen(true);
    } finally {
      setIsFavoriteLoaded(true);
    }
  }

  async function handleToggleFavorite() {
    if (isFavoriteSubmitting) {
      return;
    }

    setIsFavoriteSubmitting(true);
    setFavoriteErrorMessage('');

    try {
      const response = await fetch(`/api/site/blog/${siteName}/favorites`, {
        method: 'PATCH',
        credentials: 'include',
      });

      const result = (await response.json()) as FavoriteResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '즐겨찾기를 처리하지 못했습니다.');
      }

      setIsFavoriteLoggedIn(true);
      setIsFavorited(result.isFavorited === true);
      setFavoriteCount(typeof result.favoriteCount === 'number' ? result.favoriteCount : 0);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setFavoriteErrorMessage(unknownError.message || '즐겨찾기를 처리하지 못했습니다.');
      } else {
        setFavoriteErrorMessage('즐겨찾기를 처리하지 못했습니다.');
      }

      setIsFavoriteErrorDialogOpen(true);
    } finally {
      setIsFavoriteSubmitting(false);
    }
  }

  useEffect(() => {
    void loadFavoriteStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteName]);

  function getMyMemberGeneral() {
    return members.find((member) => member.isMine) ?? null;
  }

  function getItems(itemType: ItemType) {
    if (itemType === 'educations') {
      return educations;
    }

    if (itemType === 'awards') {
      return awards;
    }

    if (itemType === 'projects') {
      return projects;
    }

    return careers;
  }

  function setItems(itemType: ItemType, nextItems: TeamBlogItem[]) {
    if (itemType === 'educations') {
      setEducations(nextItems as MemberEducation[]);
      return;
    }

    if (itemType === 'awards') {
      setAwards(nextItems as MemberAward[]);
      return;
    }

    if (itemType === 'projects') {
      setProjects(nextItems as MemberProject[]);
      return;
    }

    setCareers(nextItems as MemberCareer[]);
  }

  function handleOpenGeneralDialog() {
    const currentMyMemberGeneral = getMyMemberGeneral();

    setErrorMessage('');

    if (currentMyMemberGeneral) {
      setGeneralFormValue({
        nameKo: currentMyMemberGeneral.name_ko ?? '',
        nameEn: currentMyMemberGeneral.name_en ?? '',
        descriptionKo: currentMyMemberGeneral.description_ko ?? '',
        descriptionEn: currentMyMemberGeneral.description_en ?? '',
        startWorkDate: toInputDateValue(currentMyMemberGeneral.start_work_date),
        job: currentMyMemberGeneral.job ?? '',
      });
    } else {
      setGeneralFormValue(createEmptyGeneralFormValue());
    }

    setIsGeneralDialogOpen(true);
  }

  function handleCloseGeneralDialog() {
    if (isSubmitting) {
      return;
    }

    setIsGeneralDialogOpen(false);
    setErrorMessage('');
  }

  function handleOpenNicknameDialog() {
    const currentMyMemberGeneral = getMyMemberGeneral();

    setNicknameErrorMessage('');
    setNicknameValue(currentMyMemberGeneral?.nickname ?? '');
    setIsNicknameDialogOpen(true);
  }

  function handleCloseNicknameDialog() {
    if (isNicknameSubmitting) {
      return;
    }

    setIsNicknameDialogOpen(false);
    setNicknameErrorMessage('');
  }

  function handleOpenItemManageDialog(itemType: ItemType) {
    setItemErrorMessage('');
    setItemManageDialogType(itemType);
  }

  function handleCloseItemManageDialog() {
    if (isItemSubmitting) {
      return;
    }

    setItemManageDialogType(null);
    setItemErrorMessage('');
  }

  function handleOpenItemFormDialog(itemType: ItemType, item?: TeamBlogItem) {
    setItemErrorMessage('');
    setItemFormDialogType(itemType);
    setEditingItem(item ?? null);

    if (!item) {
      setItemFormValue(createEmptyItemFormValue());
      return;
    }

    if (isEducation(item)) {
      setItemFormValue({
        ...createEmptyItemFormValue(),
        school: item.school,
        major: item.major ?? '',
        startDate: toInputDateValue(item.start_date),
        endDate: toInputDateValue(item.end_date),
      });
      return;
    }

    if (isAward(item)) {
      setItemFormValue({
        ...createEmptyItemFormValue(),
        subject: item.subject,
        institution: item.institution,
        dateTime: toInputDateValue(item.date_time),
      });
      return;
    }

    if (isProject(item)) {
      setItemFormValue({
        ...createEmptyItemFormValue(),
        subject: item.subject,
        description: item.description ?? '',
        client: item.client ?? '',
        agency: item.agency ?? '',
        siteNameValue: item.site_name ?? '',
        siteUrl: item.site_url ?? '',
        workStartDate: toInputDateValue(item.work_start_date),
        workEndDate: toInputDateValue(item.work_end_date),
      });
      return;
    }

    setItemFormValue({
      ...createEmptyItemFormValue(),
      organization: item.organization,
      teamPosition: item.team_position,
      roleJob: item.role_job,
      workStartDate: toInputDateValue(item.work_start_date),
      workEndDate: toInputDateValue(item.work_end_date),
    });
  }

  function handleCloseItemFormDialog() {
    if (isItemSubmitting) {
      return;
    }

    setItemFormDialogType(null);
    setEditingItem(null);
    setItemFormValue(createEmptyItemFormValue());
    setItemErrorMessage('');
  }

  function handleChangeGeneralTextField(
    key: keyof GeneralFormValue,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setGeneralFormValue((previousValue) => ({
      ...previousValue,
      [key]: event.target.value,
    }));
    setErrorMessage('');
  }

  function handleChangeItemTextField(
    key: keyof ItemFormValue,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setItemFormValue((previousValue) => ({
      ...previousValue,
      [key]: event.target.value,
    }));
    setItemErrorMessage('');
  }

  function handleChangeNickname(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setNicknameValue(event.target.value);
    setNicknameErrorMessage('');
  }

  function handleChangeGeneralStartWorkDate(value: Date | null) {
    setGeneralFormValue((previousValue) => ({
      ...previousValue,
      startWorkDate: toPayloadDate(value),
    }));
    setErrorMessage('');
  }

  function handleChangeItemDate(key: keyof ItemFormValue, value: Date | null) {
    setItemFormValue((previousValue) => ({
      ...previousValue,
      [key]: toPayloadDate(value),
    }));
    setItemErrorMessage('');
  }

  async function handleSubmitGeneral() {
    const currentMyMemberGeneral = getMyMemberGeneral();

    if (isSubmitting) {
      return;
    }

    if (!generalFormValue.nameKo.trim() && !generalFormValue.nameEn.trim()) {
      setErrorMessage('국문명 또는 영문명 중 하나는 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(
        currentMyMemberGeneral ? '/api/team-blog/edit/general' : '/api/team-blog/new/general',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            siteName,
            memberGeneralId: currentMyMemberGeneral?.id ?? null,
            nameKo: generalFormValue.nameKo,
            nameEn: generalFormValue.nameEn,
            descriptionKo: generalFormValue.descriptionKo,
            descriptionEn: generalFormValue.descriptionEn,
            startWorkDate: generalFormValue.startWorkDate,
            job: generalFormValue.job,
          }),
        },
      );

      const result = (await response.json()) as MemberGeneralResponse;

      if (!response.ok || !result.memberGeneral) {
        throw new Error(result.error ?? '팀원 기본 정보 저장에 실패했습니다.');
      }

      const nextMemberGeneral: MemberGeneral = {
        ...result.memberGeneral,
        nickname: currentMyMemberGeneral?.nickname ?? nicknameValue,
        isMine: true,
      };

      setMembers((previousMembers) => {
        const exists = previousMembers.some((member) => member.id === nextMemberGeneral.id);

        if (exists) {
          return previousMembers.map((member) => (member.id === nextMemberGeneral.id ? nextMemberGeneral : member));
        }

        return [...previousMembers, nextMemberGeneral];
      });

      setIsGeneralDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '팀원 기본 정보 저장에 실패했습니다.');
      } else {
        setErrorMessage('팀원 기본 정보 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitNickname() {
    if (isNicknameSubmitting) {
      return;
    }

    if (!nicknameValue.trim()) {
      setNicknameErrorMessage('별명을 입력해주세요.');
      return;
    }

    setIsNicknameSubmitting(true);
    setNicknameErrorMessage('');

    try {
      const response = await fetch('/api/team-blog/edit/nickname', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          nickname: nicknameValue,
        }),
      });

      const result = (await response.json()) as NicknameResponse;

      if (!response.ok || !result.member) {
        throw new Error(result.error ?? '별명 수정에 실패했습니다.');
      }

      setMembers((previousMembers) =>
        previousMembers.map((member) =>
          member.isMine
            ? {
                ...member,
                nickname: result.member?.nickname ?? nicknameValue.trim(),
              }
            : member,
        ),
      );

      setNicknameValue(result.member.nickname);
      setIsNicknameDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setNicknameErrorMessage(unknownError.message || '별명 수정에 실패했습니다.');
      } else {
        setNicknameErrorMessage('별명 수정에 실패했습니다.');
      }
    } finally {
      setIsNicknameSubmitting(false);
    }
  }

  function validateItemForm(itemType: ItemType) {
    if (itemType === 'educations' && !itemFormValue.school.trim()) {
      return '학교명을 입력해주세요.';
    }

    if (itemType === 'awards') {
      if (!itemFormValue.subject.trim()) {
        return '수상명을 입력해주세요.';
      }

      if (!itemFormValue.institution.trim()) {
        return '수여기관을 입력해주세요.';
      }
    }

    if (itemType === 'projects' && !itemFormValue.subject.trim()) {
      return '프로젝트명을 입력해주세요.';
    }

    if (itemType === 'careers') {
      if (!itemFormValue.organization.trim()) {
        return '소속 단체를 입력해주세요.';
      }

      if (!itemFormValue.teamPosition.trim()) {
        return '팀명 또는 위치를 입력해주세요.';
      }

      if (!itemFormValue.roleJob.trim()) {
        return '역할 또는 직무를 입력해주세요.';
      }
    }

    return '';
  }

  async function handleSubmitItem() {
    if (!itemFormDialogType || isItemSubmitting) {
      return;
    }

    const validationMessage = validateItemForm(itemFormDialogType);

    if (validationMessage) {
      setItemErrorMessage(validationMessage);
      return;
    }

    setIsItemSubmitting(true);
    setItemErrorMessage('');

    try {
      const response = await fetch(
        editingItem ? `/api/team-blog/edit/${itemFormDialogType}` : `/api/team-blog/new/${itemFormDialogType}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            siteName,
            itemId: editingItem?.id ?? null,
            ...itemFormValue,
          }),
        },
      );

      const result = (await response.json()) as TeamBlogItemResponse;

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? '항목 저장에 실패했습니다.');
      }

      const currentMyMemberGeneral = getMyMemberGeneral();
      const nextItem = {
        ...result.item,
        nickname: currentMyMemberGeneral?.nickname ?? '',
        isMine: true,
      };

      const previousItems = getItems(itemFormDialogType);
      const exists = previousItems.some((item) => item.id === nextItem.id);
      const nextItems = exists
        ? previousItems.map((item) => (item.id === nextItem.id ? nextItem : item))
        : [nextItem, ...previousItems];

      setItems(itemFormDialogType, nextItems);
      handleCloseItemFormDialog();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setItemErrorMessage(unknownError.message || '항목 저장에 실패했습니다.');
      } else {
        setItemErrorMessage('항목 저장에 실패했습니다.');
      }
    } finally {
      setIsItemSubmitting(false);
    }
  }

  async function saveOrder(itemType: ItemType, nextItems: TeamBlogItem[]) {
    try {
      const response = await fetch(`/api/team-blog/edit/order/${itemType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          orderedIds: nextItems.map((item) => item.id),
        }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? '정렬 저장에 실패했습니다.');
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setItemErrorMessage(unknownError.message || '정렬 저장에 실패했습니다.');
      } else {
        setItemErrorMessage('정렬 저장에 실패했습니다.');
      }
    }
  }

  function handleDragEnd(itemType: ItemType, event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const currentItems = getItems(itemType).filter((item) => item.isMine);
    const oldIndex = currentItems.findIndex((item) => item.id === active.id);
    const newIndex = currentItems.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const nextMyItems = arrayMove(currentItems, oldIndex, newIndex);
    const otherItems = getItems(itemType).filter((item) => !item.isMine);
    const nextItems = [...nextMyItems, ...otherItems];

    setItems(itemType, nextItems);
    void saveOrder(itemType, nextMyItems);
  }

  function renderEducationRange(startDate: string | null, endDate: string | null) {
    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)} 졸업`;
    }

    if (startDate) {
      return `${formatDate(startDate)} 입학`;
    }

    if (endDate) {
      return `${formatDate(endDate)} 졸업`;
    }

    return '';
  }

  function renderProjectRange(startDate: string | null, endDate: string | null) {
    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }

    if (startDate) {
      return `${formatDate(startDate)} 시작`;
    }

    if (endDate) {
      return `${formatDate(endDate)} 종료`;
    }

    return '';
  }

  function renderCareerRange(startDate: string | null, endDate: string | null) {
    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }

    if (startDate) {
      return `${formatDate(startDate)} 입사`;
    }

    if (endDate) {
      return `${formatDate(endDate)} 퇴사`;
    }

    return '';
  }

  function renderItem(item: TeamBlogItem) {
    if (isEducation(item)) {
      return (
        <p>
          {item.school}
          {item.major ? <span>{item.major}</span> : null}
          {renderEducationRange(item.start_date, item.end_date) ? (
            <time>{renderEducationRange(item.start_date, item.end_date)}</time>
          ) : null}
        </p>
      );
    }

    if (isAward(item)) {
      return (
        <p>
          {item.subject}
          <span>
            {item.institution}
            {item.date_time ? <time>{formatDate(item.date_time)}</time> : null}
          </span>
        </p>
      );
    }

    if (isProject(item)) {
      return (
        <>
          <p className={styles.subject}>{item.subject}</p>
          {item.client || item.agency ? (
            <p className={styles.org}>
              {item.client ? <span>{item.client}</span> : null}
              {item.client && item.agency ? ' / ' : null}
              {item.agency ? <span>{item.agency}</span> : null}
            </p>
          ) : null}
          {item.site_name && item.site_url ? (
            <Anchor href={item.site_url}>{item.site_name}</Anchor>
          ) : item.site_name ? (
            <p className={styles.name}>{item.site_name}</p>
          ) : item.site_url ? (
            <Anchor href={item.site_url}>{item.site_url}</Anchor>
          ) : null}
          {item.description ? <p className={styles.description}>{item.description}</p> : null}
          {renderProjectRange(item.work_start_date, item.work_end_date) ? (
            <p className={styles.time}>{renderProjectRange(item.work_start_date, item.work_end_date)}</p>
          ) : null}
        </>
      );
    }

    return (
      <>
        <p className={styles.organization}>{item.organization}</p>
        <p className={styles.posrole}>
          <span>{item.team_position}</span> / <span>{item.role_job}</span>
        </p>
        {renderCareerRange(item.work_start_date, item.work_end_date) ? (
          <p className={styles.time}>{renderCareerRange(item.work_start_date, item.work_end_date)}</p>
        ) : null}
      </>
    );
  }

  function renderItemList(title: string, item: string, items: TeamBlogItem[]) {
    if (items.length === 0) {
      return null;
    }

    return (
      <div aria-label={title} className={styles[`${item}-items`]}>
        {items.map((item) => (
          <div key={item.id}>{renderItem(item)}</div>
        ))}
      </div>
    );
  }

  function renderItemForm(itemType: ItemType) {
    if (itemType === 'educations') {
      return (
        <>
          <Stack>
            <Typography variant="subtitle2">학교명</Typography>
            <TextField
              required
              value={itemFormValue.school}
              onChange={(event) => handleChangeItemTextField('school', event)}
              fullWidth
              size="small"
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">전공</Typography>
            <TextField
              value={itemFormValue.major}
              onChange={(event) => handleChangeItemTextField('major', event)}
              fullWidth
              size="small"
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">입학일</Typography>
            <DatePicker
              value={toDateValue(itemFormValue.startDate)}
              onChange={(value) => handleChangeItemDate('startDate', value)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                },
              }}
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">졸업</Typography>
            <DatePicker
              value={toDateValue(itemFormValue.endDate)}
              onChange={(value) => handleChangeItemDate('endDate', value)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                },
              }}
            />
          </Stack>
        </>
      );
    }

    if (itemType === 'awards') {
      return (
        <>
          <Stack>
            <Typography variant="subtitle2">수상명</Typography>
            <TextField
              required
              value={itemFormValue.subject}
              onChange={(event) => handleChangeItemTextField('subject', event)}
              fullWidth
              size="small"
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">수여기관</Typography>
            <TextField
              required
              value={itemFormValue.institution}
              onChange={(event) => handleChangeItemTextField('institution', event)}
              fullWidth
              size="small"
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">수상일</Typography>
            <DatePicker
              value={toDateValue(itemFormValue.dateTime)}
              onChange={(value) => handleChangeItemDate('dateTime', value)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                },
              }}
            />
          </Stack>
        </>
      );
    }

    if (itemType === 'projects') {
      return (
        <>
          <Stack>
            <Typography variant="subtitle2">프로젝트명</Typography>
            <TextField
              required
              value={itemFormValue.subject}
              onChange={(event) => handleChangeItemTextField('subject', event)}
              fullWidth
              size="small"
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">시작일</Typography>
            <DatePicker
              value={toDateValue(itemFormValue.workStartDate)}
              onChange={(value) => handleChangeItemDate('workStartDate', value)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                },
              }}
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">종료일</Typography>
            <DatePicker
              value={toDateValue(itemFormValue.workEndDate)}
              onChange={(value) => handleChangeItemDate('workEndDate', value)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                },
              }}
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">설명</Typography>
            <TextField
              value={itemFormValue.description}
              onChange={(event) => handleChangeItemTextField('description', event)}
              fullWidth
              size="small"
              multiline
              minRows={3}
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">수주사/원청</Typography>
            <TextField
              value={itemFormValue.client}
              onChange={(event) => handleChangeItemTextField('client', event)}
              fullWidth
              size="small"
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">소속 단체/회사/팀</Typography>
            <TextField
              value={itemFormValue.agency}
              onChange={(event) => handleChangeItemTextField('agency', event)}
              fullWidth
              size="small"
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">사이트명</Typography>
            <TextField
              value={itemFormValue.siteNameValue}
              onChange={(event) => handleChangeItemTextField('siteNameValue', event)}
              fullWidth
              size="small"
            />
          </Stack>
          <Stack>
            <Typography variant="subtitle2">사이트 URL</Typography>
            <TextField
              type="url"
              value={itemFormValue.siteUrl}
              onChange={(event) => handleChangeItemTextField('siteUrl', event)}
              fullWidth
              size="small"
            />
          </Stack>
        </>
      );
    }

    return (
      <>
        <Stack>
          <Typography variant="subtitle2">소속 단체</Typography>
          <TextField
            required
            value={itemFormValue.organization}
            onChange={(event) => handleChangeItemTextField('organization', event)}
            fullWidth
            size="small"
          />
        </Stack>
        <Stack>
          <Typography variant="subtitle2">팀명 또는 위치</Typography>
          <TextField
            required
            value={itemFormValue.teamPosition}
            onChange={(event) => handleChangeItemTextField('teamPosition', event)}
            fullWidth
            size="small"
          />
        </Stack>
        <Stack>
          <Typography variant="subtitle2">역할 또는 직무</Typography>
          <TextField
            required
            value={itemFormValue.roleJob}
            onChange={(event) => handleChangeItemTextField('roleJob', event)}
            fullWidth
            size="small"
          />
        </Stack>
        <Stack>
          <Typography variant="subtitle2">입사일</Typography>
          <DatePicker
            onChange={(value) => handleChangeItemDate('workStartDate', value)}
            slotProps={{
              textField: {
                fullWidth: true,
                size: 'small',
              },
            }}
          />
        </Stack>
        <Stack>
          <Typography variant="subtitle2">퇴사일</Typography>
          <DatePicker
            value={toDateValue(itemFormValue.workEndDate)}
            onChange={(value) => handleChangeItemDate('workEndDate', value)}
            slotProps={{
              textField: {
                fullWidth: true,
                size: 'small',
              },
            }}
          />
        </Stack>
      </>
    );
  }

  function renderManageDialogItem(itemType: ItemType, item: TeamBlogItem) {
    return (
      <div className={`${styles['dnd-items']} ${styles[`${itemType}-items`]}`}>
        <div className={styles['dnd-item']}>{renderItem(item)}</div>
        <button type="button" className="button small action" onClick={() => handleOpenItemFormDialog(itemType, item)}>
          수정
        </button>
      </div>
    );
  }

  const isGeneralSubmitDisabled = isSubmitting || (!generalFormValue.nameKo.trim() && !generalFormValue.nameEn.trim());
  const isNicknameSubmitDisabled = isNicknameSubmitting || !nicknameValue.trim();
  const isItemSubmitDisabled = itemFormDialogType
    ? isItemSubmitting || Boolean(validateItemForm(itemFormDialogType))
    : true;
  const itemManageItems = itemManageDialogType ? getItems(itemManageDialogType).filter((item) => item.isMine) : [];

  function renderMemberName(member: MemberGeneral) {
    const nickname = member.nickname?.trim() ?? '';
    const nameKo = member.name_ko?.trim() ?? '';
    const nameEn = member.name_en?.trim() ?? '';

    const primaryName = nameKo || nickname || nameEn;

    const subNames = [
      nameKo && nameKo !== primaryName ? nameKo : '',
      nameEn && nameEn !== primaryName ? nameEn : '',
    ].filter(Boolean);

    if (!primaryName) {
      return null;
    }

    if (subNames.length === 0) {
      return <p className={styles.name}>{primaryName}</p>;
    }

    return (
      <p className={styles.name}>
        {primaryName} (
        {subNames.map((subName, index) => (
          <span key={subName}>
            ({index > 0 ? ' ' : null}
            {subName})
          </span>
        ))}
        )
      </p>
    );
  }

  return (
    <main>
      <div className="container">
        <div className={`content ${styles.content}`}>
          <div className={`${styles['site-info']} paper`}>
            <div className={styles['site-info-header']}>
              <div className={styles['info-site-name']}>
                <em>{getSiteTypeLabel(siteInfo.site_type)}</em> <strong>{siteLabel}</strong>
              </div>
              <div className={styles['info-site-favorite']}>
                {isFavoriteLoaded ? (
                  isFavoriteLoggedIn ? (
                    <button
                      type="button"
                      className={`${styles.button} ${isFavorited ? styles.active : ''}`}
                      onClick={() => void handleToggleFavorite()}
                      disabled={isFavoriteSubmitting}
                      aria-label={isFavorited ? '즐겨찾기 해제' : '즐겨찾기'}
                    >
                      {isFavoriteSubmitting ? (
                        <CircularProgress color="inherit" aria-label="즐겨찾기 등록상태 저장중" size={24} />
                      ) : (
                        <StarBorderRoundedIcon />
                      )}
                      <strong>즐겨찾기</strong>
                      {favoriteCount > 0 ? <em aria-label="즐겨찾기 등록한 수">{favoriteCount}</em> : null}
                    </button>
                  ) : (
                    <Anchor href="/auth/sign-in" className={styles.button}>
                      <strong>즐겨찾기</strong>
                      {favoriteCount > 0 ? <em aria-label="즐겨찾기 등록한 수">{favoriteCount}</em> : null}
                    </Anchor>
                  )
                ) : null}
              </div>
            </div>
            <p className={styles['info-date']}>({formatDate(siteInfo.created_at)} 개설)</p>
            {siteInfo.summary ? <p className={styles['info-summary']}>{siteInfo.summary}</p> : null}

            {members.length > 0 ? (
              <div className={styles['members']}>
                <strong>작가 소개</strong>

                <div className={styles['member-items']}>
                  {members.map((member) => {
                    const memberEducationsByMember = educations.filter(
                      (education) => education.member_id === member.member_id,
                    );
                    const memberAwardsByMember = awards.filter((award) => award.member_id === member.member_id);
                    const memberProjectsByMember = projects.filter((project) => project.member_id === member.member_id);
                    const memberCareersByMember = careers.filter((career) => career.member_id === member.member_id);

                    return (
                      <div key={member.id} className={`paper ${styles['member-item']}`}>
                        <div className={styles['general-items']}>
                          {renderMemberName(member)}
                          {member.job ? <p className={styles.job}>{member.job}</p> : null}
                          {member.start_work_date ? (
                            <p className={styles.date}>{formatDate(member.start_work_date)}부터 생산활동 시작 💃</p>
                          ) : null}
                          {member.description_ko || member.description_en ? (
                            <div className={styles.descriptions}>
                              {member.description_ko ? (
                                <p className={styles.description}>{member.description_ko}</p>
                              ) : null}
                              {member.description_en ? (
                                <p className={styles.description}>{member.description_en}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {renderItemList('학력', 'educations', memberEducationsByMember)}
                        {renderItemList('수상', 'awards', memberAwardsByMember)}
                        {renderItemList('프로젝트', 'projects', memberProjectsByMember)}
                        {renderItemList('경력', 'careers', memberCareersByMember)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {canEditMyMemberGeneral ? (
              <div className={styles.buttons}>
                <button type="button" className="button small submit" onClick={handleOpenNicknameDialog}>
                  별명 수정
                </button>
                <button type="button" className="button small submit" onClick={handleOpenGeneralDialog}>
                  기본정보 수정
                </button>
                {getMyMemberGeneral() ? (
                  <div className={styles['manage-advanced-buttons']}>
                    <button
                      type="button"
                      className="button action small"
                      onClick={() => handleOpenItemManageDialog('educations')}
                    >
                      학력 입력
                    </button>
                    <button
                      type="button"
                      className="button action small"
                      onClick={() => handleOpenItemManageDialog('awards')}
                    >
                      수상 입력
                    </button>
                    <button
                      type="button"
                      className="button action small"
                      onClick={() => handleOpenItemManageDialog('projects')}
                    >
                      프로젝트 입력
                    </button>
                    <button
                      type="button"
                      className="button action small"
                      onClick={() => handleOpenItemManageDialog('careers')}
                    >
                      경력 입력
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isGeneralDialogOpen}
          onClose={handleCloseGeneralDialog}
          className="VhiDrawer-bottom"
        >
          <h2>팀원 기본 정보</h2>
          <button
            className="close-button"
            onClick={handleCloseGeneralDialog}
            aria-label="팀원 기본 정보 닫기"
            disabled={isSubmitting}
          >
            <CloseRoundedIcon />
          </button>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <Stack direction="column" gap={1}>
                <Stack>
                  <Typography variant="subtitle2">국문명</Typography>
                  <TextField
                    value={generalFormValue.nameKo}
                    onChange={(event) => handleChangeGeneralTextField('nameKo', event)}
                    fullWidth
                    size="small"
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">영문명</Typography>
                  <TextField
                    value={generalFormValue.nameEn}
                    onChange={(event) => handleChangeGeneralTextField('nameEn', event)}
                    fullWidth
                    size="small"
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">본인소개 국문</Typography>
                  <TextField
                    value={generalFormValue.descriptionKo}
                    onChange={(event) => handleChangeGeneralTextField('descriptionKo', event)}
                    fullWidth
                    size="small"
                    multiline
                    minRows={3}
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">본인소개 영문</Typography>
                  <TextField
                    value={generalFormValue.descriptionEn}
                    onChange={(event) => handleChangeGeneralTextField('descriptionEn', event)}
                    fullWidth
                    size="small"
                    multiline
                    minRows={3}
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">경력시작일</Typography>
                  <DatePicker
                    value={toDateValue(generalFormValue.startWorkDate)}
                    onChange={handleChangeGeneralStartWorkDate}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                      },
                    }}
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">직업</Typography>
                  <TextField
                    value={generalFormValue.job}
                    onChange={(event) => handleChangeGeneralTextField('job', event)}
                    fullWidth
                    size="small"
                  />
                </Stack>

                {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
              </Stack>
            </LocalizationProvider>
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleCloseGeneralDialog}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void handleSubmitGeneral()}
                disabled={isGeneralSubmitDisabled}
              >
                저장
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isGeneralDialogOpen}
          onClose={handleCloseGeneralDialog}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>팀원 기본 정보</DialogTitle>
          <button
            className="close-button"
            onClick={handleCloseGeneralDialog}
            disabled={isSubmitting}
            aria-label="팀원 기본 정보 닫기"
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <Stack direction="column" gap={1}>
                <Stack>
                  <Typography variant="subtitle2">국문명</Typography>
                  <TextField
                    value={generalFormValue.nameKo}
                    onChange={(event) => handleChangeGeneralTextField('nameKo', event)}
                    fullWidth
                    size="small"
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">영문명</Typography>
                  <TextField
                    value={generalFormValue.nameEn}
                    onChange={(event) => handleChangeGeneralTextField('nameEn', event)}
                    fullWidth
                    size="small"
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">본인소개 국문</Typography>
                  <TextField
                    value={generalFormValue.descriptionKo}
                    onChange={(event) => handleChangeGeneralTextField('descriptionKo', event)}
                    fullWidth
                    size="small"
                    multiline
                    minRows={3}
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">본인소개 영문</Typography>
                  <TextField
                    value={generalFormValue.descriptionEn}
                    onChange={(event) => handleChangeGeneralTextField('descriptionEn', event)}
                    fullWidth
                    size="small"
                    multiline
                    minRows={3}
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">경력시작일</Typography>
                  <DatePicker
                    value={toDateValue(generalFormValue.startWorkDate)}
                    onChange={handleChangeGeneralStartWorkDate}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                      },
                    }}
                  />
                </Stack>

                <Stack>
                  <Typography variant="subtitle2">직업</Typography>
                  <TextField
                    value={generalFormValue.job}
                    onChange={(event) => handleChangeGeneralTextField('job', event)}
                    fullWidth
                    size="small"
                  />
                </Stack>

                {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
              </Stack>
            </LocalizationProvider>
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium close"
              onClick={handleCloseGeneralDialog}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handleSubmitGeneral()}
              disabled={isGeneralSubmitDisabled}
            >
              저장
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isNicknameDialogOpen}
          onClose={handleCloseNicknameDialog}
          className="VhiDrawer-bottom"
        >
          <h2>별명 수정</h2>
          <button
            className="close-button"
            onClick={handleCloseNicknameDialog}
            disabled={isNicknameSubmitting}
            aria-label="별명 수정 닫기"
          >
            <CloseRoundedIcon />
          </button>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack gap={2}>
              <TextField
                placeholder="별명"
                value={nicknameValue}
                onChange={handleChangeNickname}
                fullWidth
                size="small"
              />

              {nicknameErrorMessage ? (
                <div className={`paper paper-error ${styles.paper}`}>{nicknameErrorMessage}</div>
              ) : null}
            </Stack>
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleCloseNicknameDialog}
                disabled={isNicknameSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void handleSubmitNickname()}
                disabled={isNicknameSubmitDisabled}
              >
                저장
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isNicknameDialogOpen}
          onClose={handleCloseNicknameDialog}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>별명 수정</DialogTitle>
          <button
            className="close-button"
            onClick={handleCloseNicknameDialog}
            disabled={isNicknameSubmitting}
            aria-label="별명 수정 닫기"
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Stack gap={2}>
              <TextField
                placeholder="별명"
                value={nicknameValue}
                onChange={handleChangeNickname}
                fullWidth
                size="small"
              />

              {nicknameErrorMessage ? (
                <div className={`paper paper-error ${styles.paper}`}>{nicknameErrorMessage}</div>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium close"
              onClick={handleCloseNicknameDialog}
              disabled={isNicknameSubmitting}
            >
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handleSubmitNickname()}
              disabled={isNicknameSubmitDisabled}
            >
              저장
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(itemManageDialogType)}
          onClose={handleCloseItemManageDialog}
          className="VhiDrawer-bottom"
        >
          <h2>{itemManageDialogType ? `${getItemTypeLabel(itemManageDialogType)} 관리` : ''}</h2>
          <button
            className="close-button"
            onClick={handleCloseItemManageDialog}
            aria-label={itemManageDialogType ? `${getItemTypeLabel(itemManageDialogType)} 관리 닫기` : ''}
          >
            <CloseRoundedIcon />
          </button>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="column" gap={1} sx={{ p: 1 }}>
              {itemManageDialogType ? (
                <>
                  <button
                    type="button"
                    className="button medium action"
                    onClick={() => handleOpenItemFormDialog(itemManageDialogType)}
                  >
                    {getItemTypeLabel(itemManageDialogType)} 추가
                  </button>

                  {itemManageItems.length > 0 ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(itemManageDialogType, event)}
                    >
                      <SortableContext
                        items={itemManageItems.map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <Stack direction="column" gap={1} sx={{ p: 1 }}>
                          {itemManageItems.map((item) => (
                            <SortableItem key={item.id} id={item.id}>
                              {renderManageDialogItem(itemManageDialogType, item)}
                            </SortableItem>
                          ))}
                        </Stack>
                      </SortableContext>
                    </DndContext>
                  ) : null}
                </>
              ) : null}

              {itemErrorMessage ? <div className={`paper paper-error ${styles.paper}`}>{itemErrorMessage}</div> : null}
            </Stack>
            <Stack direction="column" spacing={1.5}>
              <button type="button" className="button medium cancel" onClick={handleCloseItemManageDialog}>
                닫기
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(itemManageDialogType)}
          onClose={handleCloseItemManageDialog}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>{itemManageDialogType ? `${getItemTypeLabel(itemManageDialogType)} 관리` : ''}</DialogTitle>
          <button
            className="close-button"
            onClick={handleCloseItemManageDialog}
            aria-label={itemManageDialogType ? `${getItemTypeLabel(itemManageDialogType)} 관리 닫기` : ''}
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Stack direction="column" gap={1} sx={{ p: 1 }}>
              {itemManageDialogType ? (
                <>
                  <button
                    type="button"
                    className="button medium action"
                    onClick={() => handleOpenItemFormDialog(itemManageDialogType)}
                  >
                    {getItemTypeLabel(itemManageDialogType)} 추가
                  </button>

                  {itemManageItems.length > 0 ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(itemManageDialogType, event)}
                    >
                      <SortableContext
                        items={itemManageItems.map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <Stack direction="column" gap={1} sx={{ p: 1 }}>
                          {itemManageItems.map((item) => (
                            <SortableItem key={item.id} id={item.id}>
                              {renderManageDialogItem(itemManageDialogType, item)}
                            </SortableItem>
                          ))}
                        </Stack>
                      </SortableContext>
                    </DndContext>
                  ) : null}
                </>
              ) : null}

              {itemErrorMessage ? <div className={`paper paper-error ${styles.paper}`}>{itemErrorMessage}</div> : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={handleCloseItemManageDialog}>
              닫기
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(itemFormDialogType)}
          onClose={handleCloseItemFormDialog}
          className="VhiDrawer-bottom"
        >
          <h2>
            {itemFormDialogType ? `${getItemTypeLabel(itemFormDialogType)} ${editingItem ? '수정' : '추가'}` : ''}
          </h2>
          <button
            className="close-button"
            onClick={handleCloseItemFormDialog}
            disabled={isItemSubmitting}
            aria-label={
              itemFormDialogType ? `${getItemTypeLabel(itemFormDialogType)} ${editingItem ? '수정' : '추가'} 닫기` : ''
            }
          >
            <CloseRoundedIcon />
          </button>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <Stack direction="column" gap={1}>
                {itemFormDialogType ? renderItemForm(itemFormDialogType) : null}
                {itemErrorMessage ? (
                  <div className={`paper paper-error ${styles.paper}`}>{itemErrorMessage}</div>
                ) : null}
              </Stack>
            </LocalizationProvider>
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleCloseItemFormDialog}
                disabled={isItemSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void handleSubmitItem()}
                disabled={isItemSubmitDisabled}
              >
                저장
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(itemFormDialogType)}
          onClose={handleCloseItemFormDialog}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>
            {itemFormDialogType ? `${getItemTypeLabel(itemFormDialogType)} ${editingItem ? '수정' : '추가'}` : ''}
          </DialogTitle>
          <button
            className="close-button"
            onClick={handleCloseItemFormDialog}
            disabled={isItemSubmitting}
            aria-label={
              itemFormDialogType ? `${getItemTypeLabel(itemFormDialogType)} ${editingItem ? '수정' : '추가'} 닫기` : ''
            }
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <Stack direction="column" gap={1}>
                {itemFormDialogType ? renderItemForm(itemFormDialogType) : null}
                {itemErrorMessage ? (
                  <div className={`paper paper-error ${styles.paper}`}>{itemErrorMessage}</div>
                ) : null}
              </Stack>
            </LocalizationProvider>
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium close"
              onClick={handleCloseItemFormDialog}
              disabled={isItemSubmitting}
            >
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handleSubmitItem()}
              disabled={isItemSubmitDisabled}
            >
              저장
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isFavoriteErrorDialogOpen}
          onClose={() => setIsFavoriteErrorDialogOpen(false)}
          className="VhiDrawer-bottom"
        >
          <h2>즐겨찾기 오류</h2>
          <button
            className="close-button"
            onClick={() => setIsFavoriteErrorDialogOpen(false)}
            disabled={isSubmitting}
            aria-label="즐겨찾기 오류 닫기"
          >
            <CloseRoundedIcon />
          </button>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <div className={`paper paper-error ${styles.paper}`}>
              {favoriteErrorMessage || '즐겨찾기를 처리하지 못했습니다.'}
            </div>

            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={() => setIsFavoriteErrorDialogOpen(false)}
              >
                확인
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isFavoriteErrorDialogOpen}
          onClose={() => setIsFavoriteErrorDialogOpen(false)}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>즐겨찾기 오류</DialogTitle>
          <button
            className="close-button"
            onClick={() => setIsFavoriteErrorDialogOpen(false)}
            disabled={isSubmitting}
            aria-label="즐겨찾기 오류 닫기"
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <div className={`paper paper-error ${styles.paper}`}>
              {favoriteErrorMessage || '즐겨찾기를 처리하지 못했습니다.'}
            </div>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium submit" onClick={() => setIsFavoriteErrorDialogOpen(false)}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </main>
  );
}
