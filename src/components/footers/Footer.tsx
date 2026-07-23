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
              <em>m-flo loves BoA</em>
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
                    <Anchor href="/heart2hearts/b/notice">공지사항</Anchor>
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
          <div className={styles.legals}>
            <dl>
              <div>
                <div>
                  <dt className={styles.hidden}>회사명</dt>
                  <dd>데브런닷스튜디오</dd>
                </div>
                <div>
                  <dt>대표자명</dt>
                  <dd>고종길</dd>
                </div>
              </div>
              <div>
                <div>
                  <dt>사업자등록번호</dt>
                  <dd>319-21-01382</dd>
                </div>
                <div>
                  <dt>통신판매업 신고번호</dt>
                  <dd>2026-서울관악-</dd>
                </div>
              </div>
              <div>
                <div>
                  <dt>주소</dt>
                  <dd>
                    <address>서울시 관악구 조원로 20길 10</address>
                  </dd>
                </div>
                <div>
                  <dt>연락처</dt>
                  <dd>010 7154 5796</dd>
                </div>
              </div>
            </dl>
            <div>
              <p>
                데브런닷스튜디오는 통신판매중개자이며 통신판매의 당사자가 아닙니다. 따라서 데브런닷스튜디오는 콘텐츠,
                거래 정보 및 거래에 대하여 책임지지 않습니다.
              </p>
              <p>
                데브런닷스튜디오가 소유/운영/관리하는 웹사이트 내의 콘텐츠/회원/이벤트 정보, 디자인 및 화면의 구성, UI를
                포함하여 일체의 콘텐츠에 대한 무단 복제, 전송, 방송, 배포, 스크래핑 등의 행위는 저작권법 및 콘텐츠산업
                진흥법 등 관련 법령에 의하여 엄격히 금지됩니다.
              </p>
            </div>
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
