const axios = require('axios');
const fs = require('fs');
const path = require('path');

// URL 인코딩된 서비스 키 사용
const serviceKey = 'cPdGKAsUpOaVmBWNujf8zCL0q+XyzMSMGebwv4/Lt+MJZCz8lOidIVcww3rhbqJ/yO8OLyRi0QJY/imdYx7zSg==' ;

// 루트 디렉토리에서 locations.json 파일 읽기
const locationsFilePath = path.join(__dirname, 'locations.json'); // 루트 디렉토리의 locations.json 파일을 읽음

let locations = [];
try {
  // JSON 파일 읽기
  locations = JSON.parse(fs.readFileSync(locationsFilePath, 'utf-8'));
} catch (error) {
  console.error("Error parsing locations.json:", error.message);
  locations = [];  // 데이터가 없으면 빈 배열로 설정
}

// 날짜와 시간을 자동으로 계산하는 함수 (이전 시간대 내림 처리)
const getCurrentDateTime = () => {
  const now = new Date();
  const base_date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const hours = now.getHours();
  let base_time = '';

  // 기상청 발표 시간을 기준으로 이전 시간대로 내림 처리
  if (hours >= 23) base_time = '2300';
  else if (hours >= 20) base_time = '2000';
  else if (hours >= 17) base_time = '1700';
  else if (hours >= 14) base_time = '1400';
  else if (hours >= 11) base_time = '1100';
  else if (hours >= 8) base_time = '0800';
  else if (hours >= 5) base_time = '0500';
  else base_time = '0200';  // 그 외는 2시

  return { base_date, base_time };
};

// 서버리스 함수
module.exports = async (req, res) => {
  let { province, city, town, base_date, base_time } = req.query;

  const locationData = locations.find(item => 
    item.province === province && item.city === city && item.town === town
  );

  if (!locationData) {
    return res.status(404).json({ error: '입력한 지역에 대한 좌표를 찾을 수 없습니다.' });
  }

  const { nx, ny } = locationData;

  // 날짜와 시간이 없을 경우 자동 설정
  if (!base_date || !base_time) {
    const { base_date: currentBaseDate, base_time: currentBaseTime } = getCurrentDateTime();
    base_date = base_date || currentBaseDate;
    base_time = base_time || currentBaseTime;
  }

  try {
    const url = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst`;
    const response = await axios.get(url, {
      params: {
        serviceKey: serviceKey,
        numOfRows: 10,
        pageNo: 1,
        base_date,
        base_time,
        nx,
        ny,
        dataType: 'JSON',
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('API 요청 중 오류 발생:', error.message);
    res.status(500).json({
      error: 'API 요청 중 오류가 발생했습니다.',
      details: error.response ? error.response.data : error.message
    });
  }
};
