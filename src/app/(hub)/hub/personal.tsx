import { Avatar } from '@mui/material';
import styles from '@/app/hub.module.sass';

type PersonalProps = {
  avatarUrl: string;
  email: string | null;
  userName: string | null;
  bio: string | null;
};

export default function Personal({ avatarUrl, email, userName, bio }: PersonalProps) {
  return (
    <section className={`${styles.paper} ${styles.profile}`}>
      <div className={styles['profile-header']}>
        <Avatar src={avatarUrl || '/avatar.png'} alt={userName || ''} sx={{ width: 72, height: 72 }} />
        <div className={styles.meta}>
          <cite>{userName}</cite>
          {email ? <span>{email}</span> : null}
        </div>
      </div>

      {bio ? (
        <div className={`paper ${styles['profile-bio']}`}>
          <p>{bio}</p>
        </div>
      ) : null}
    </section>
  );
}
