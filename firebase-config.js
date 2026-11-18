/* ============================================================
   골든픽 배틀 설정 파일 (게임·관리자 페이지가 함께 읽어요)
   1) 아래 firebase 값 6개를 새 Firebase 프로젝트 값으로 바꿔 주세요.
   2) 값이 YOUR_ 로 시작하면 "데모 모드"로 동작해요(기록이 그 기기에만 저장).
   ============================================================ */
window.GP_CONFIG = {
  firebase: {
    apiKey: "AIzaSyD19ycZePz4gYRWIkJeTT6IeGqfOr_h3uE",
    authDomain: "goldenpick-univ.firebaseapp.com",
    projectId: "goldenpick-univ",
    storageBucket: "goldenpick-univ.firebasestorage.app",
    messagingSenderId: "189717043505",
    appId: "1:189717043505:web:6509d014f2b7ef6ae3b810"
  },

  /* 화면 문구 */
  eventLine: "2026 AX농업포럼 X 제주시농협",
  title: "황금 농산물을 잡아라",
  audience: "농협대학교 학생 한정 스페셜 이벤트",
  logo: "",            // 로고 이미지 경로(예: "logo.png"). 비워두면 안 보여요.

  /* 컬렉션 이름 (농탑 이벤트와 같은 Firebase 프로젝트를 써도 겹치지 않아요) */
  collections: { users: "gp_users", ranks: "gp_ranks", config: "gp_config" },

  /* 관리자 최초 비밀번호 (배포 후 관리자 화면에서 꼭 바꿔 주세요) */
  adminDefaultPassword: "nong1234",

  /* 실시간 순위에 보여줄 인원 */
  rankLimit: 10
};
