import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import Container from '../menu';
import styles from '@/app/board.module.sass';

export default function Page() {
  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>이용 제한</h2>
            <p>운영시 약관 위반 또는 대한민국 법 위반 소지가 확인되어 제한되었습니다.</p>
            <p>이의 신청 및 소명이 가능합니다.</p>
            <div className="alerts">
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>chloe@dev1stud.io 이메일로 이의 신청 및 소명자료를 제출하세요.</span>
              </p>
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>
                  본인이 누구(가입된 이메일 주소 및 데브허브 활동명, 사이트 별명)인지, 사이트 이름 및 주소를 반드시
                  포함시켜 주세요.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
