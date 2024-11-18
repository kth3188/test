const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
const port = 3000;

// URL 인코딩된 서비스 키 사용
const serviceKey = 'cPdGKAsUpOaVmBWNujf8zCL0q+XyzMSMGebwv4/Lt+MJZCz8lOidIVcww3rhbqJ/yO8OLyRi0QJY/imdYx7zSg==';

// JSON 파일에서 장소와 좌표 매핑 데이터 로드
const locations = JSON.parse(fs.readFileSync('locations.json', 'utf-8'));

app.get('/forecast', async (req, res) => {
  let { province, city, town, base_date, base_time } = req.query;

  // 지역 정보를 기반으로 nx, ny 좌표 찾기
  const locationData = locations.find(item => 
    item.province === province && item.city === city && item.town === town
  );

  if (!locationData) {
    return res.status(404).json({ error: '입력한 지역에 대한 좌표를 찾을 수 없습니다.' });
  }

  const { nx, ny } = locationData;

  // 날짜와 시간이 없을 경우 자동 설정 (오늘 날짜와 현재 시각 기준)
  if (!base_date || !base_time) {
    const now = new Date();
    base_date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    
    // 현재 시각에 가장 가까운 기상청 발표 시간 자동 설정
    const hours = now.getHours();
    if (hours >= 23) base_time = '2300';
    else if (hours >= 20) base_time = '2000';
    else if (hours >= 17) base_time = '1700';
    else if (hours >= 14) base_time = '1400';
    else if (hours >= 11) base_time = '1100';
    else if (hours >= 8) base_time = '0800';
    else if (hours >= 5) base_time = '0500';
    else base_time = '0200';
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
        dataType: 'JSON'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('API 요청 중 오류 발생:', error.message);
    res.status(500).json({ error: 'API 요청 중 오류가 발생했습니다.', details: error.response ? error.response.data : error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});