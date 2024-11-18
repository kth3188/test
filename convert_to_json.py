import pandas as pd

# 엑셀 파일 경로 설정
excel_file = "C:/Users/web/new_test/(1)VilageFcstInfoService/location.xlsx"

# 엑셀 파일 읽기 - 시트 이름을 실제 시트 이름으로 변경
df = pd.read_excel(
    excel_file, sheet_name="location_20240101"
)  # 시트 이름을 정확히 입력

# 실제 열 이름으로 변경하여 선택
df_filtered = df[
    ["province", "city", "town", "x_coord", "y_coord"]
]  # 실제 열 이름으로 수정
df_filtered.columns = ["province", "city", "town", "nx", "ny"]  # 열 이름 변경

# JSON 파일로 저장
df_filtered.to_json("locations.json", orient="records", force_ascii=False)
print("JSON 파일로 변환 완료!")
