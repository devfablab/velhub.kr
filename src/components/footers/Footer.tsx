import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import Anchor from '../Anchor';
import VhiStudios from '../icons/VhiStudios';
import VhiHub from '../icons/VhiHub';
import styles from '@/app/footer.module.sass';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={`content ${styles.content}`}>
          <div className={styles.pages}>
            <p className={styles.aodn}>
              <i>
                <VhiHub />
              </i>
              <span>All-out-all-day-all-night</span>
              <em>by BoA</em>
            </p>
            <ul className={styles['parents-items']}>
              <li className={styles['parents-item']}>
                <ul className={styles.children}>
                  <li>
                    <Anchor href="/heart2hearts">이용안내</Anchor>
                  </li>
                  <li>
                    <Anchor href="/concierge">고객센터</Anchor>
                  </li>
                  <li>
                    <Anchor href="/concierge">공지사항</Anchor>
                  </li>
                </ul>
              </li>
              <li className={styles['parents-item']}>
                <ul className={styles.children}>
                  <li>
                    <Anchor href="/heart2hearts/b/">이용약관</Anchor>
                  </li>
                  <li>
                    <Anchor href="/heart2hearts/b/">개인정보 처리방침</Anchor>
                  </li>
                </ul>
              </li>
            </ul>
          </div>
          <div className={styles.loves}>
            <p className={styles.love} style={{ color: 'hotpink' }}>
              <FavoriteRoundedIcon /> <span>velhub</span>
            </p>
            <p className={styles.copyright}>
              <span>&copy;</span> <VhiStudios /> <span>All rights reserved.</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
