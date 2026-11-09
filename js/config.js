// 독서실 설정 — 선생님이 직접 고치는 곳
export const CONFIG = {
  // 질문 챗봇·교무실(Apps Script) 웹앱 주소 (…/exec)
  CHATBOT_URL: 'https://script.google.com/macros/s/AKfycbxGLVlo4ATOGvCdxXJm89p6KxichZzVFDKZH6jYcwcl4Q8lijNQzGaxvlNuGDwFI3rqgA/exec',
  // 교무실 '질문 코너'에 앉는 챗봇들 (순서대로 자리 배정, 최대 4)
  // name은 시트 '과목' 탭 H칸(챗봇)에 적는 이름과 같아야 해요. H칸이 비어 있는 교과는 첫 번째 챗봇이 맡아요.
  BOTS: [
    { id: 'mungchi', name: '뭉치 박사', img: 'assets/mascot.png', desc: '과학 질문' },
    { id: 'dodeokhu', name: '도덕후', img: 'assets/dodeokhu.png', desc: '도덕 질문' },
  ],
};
// 예전 이름 호환
CONFIG.MASCOT_NAME = CONFIG.BOTS[0].name;

// 같이 공부하기 (실시간) — Firebase 프로젝트 'aistudyroom'
// 이 값들은 비밀번호가 아니라 '어느 프로젝트에 연결할지' 알려주는 주소예요. 데이터는 Firebase 보안 규칙으로 보호해요.
export const FIREBASE = {
  apiKey: 'AIzaSyBGfI-pEYUXTfeYkKdF5FZzYPh_7-RvZOM',
  authDomain: 'aistudyroom.firebaseapp.com',
  databaseURL: 'https://aistudyroom-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'aistudyroom',
  storageBucket: 'aistudyroom.firebasestorage.app',
  messagingSenderId: '343644897787',
  appId: '1:343644897787:web:7866f9cb9539542e194b5e',
};
