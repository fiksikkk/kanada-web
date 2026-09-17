export interface Hotspot {
  roomN: number;
  label: string;
  floor: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

// Картинка - 761x1013. Координаты подобраны на глаз по планировке -
// только roomN:1 (Гостиная) привязан к реальной комнате в тестовой БД
// (seed_test.sql, room_number=1, устройство "Тест Дали"), остальные пока
// открывают пустую панель (в БД для них нет устройств) - это уже
// разметка под реальные комнаты плана, но данные под них ещё не заведены.
//
// floor - заглушка: реального распределения комнат по этажам ещё нет,
// все текущие 12 комнат временно на 1 этаже. Когда появятся данные по
// второму этажу - проставить сюда правильный floor для каждой записи.
export const ROOM_HOTSPOTS: Hotspot[] = [
  {
    roomN: 1,
    label: "Гостиная",
    floor: 1,
    left: 47,
    top: 19,
    width: 29,
    height: 32,
  },
  {
    roomN: 2,
    label: "Столовая",
    floor: 1,
    left: 76,
    top: 19,
    width: 17,
    height: 35.5,
  },
  {
    roomN: 3,
    label: "Кухня",
    floor: 1,
    left: 11,
    top: 19,
    width: 36,
    height: 32,
  },
  {
    roomN: 4,
    label: "Терраса",
    floor: 1,
    left: 12.5,
    top: 4,
    width: 33,
    height: 15,
  },
  {
    roomN: 5,
    label: "Холл",
    floor: 1,
    left: 42,
    top: 51,
    width: 32.5,
    height: 23,
  },
  {
    roomN: 6,
    label: "Кабинет",
    floor: 1,
    left: 19,
    top: 67,
    width: 30,
    height: 25,
  },
  {
    roomN: 7,
    label: "Постирночная",
    floor: 1,
    left: 15,
    top: 56,
    width: 27,
    height: 11,
  },
  {
    roomN: 8,
    label: "Прихожая",
    floor: 1,
    left: 49,
    top: 74,
    width: 25.5,
    height: 9,
  },
  {
    roomN: 9,
    label: "Санузел",
    floor: 1,
    left: 74.5,
    top: 54.5,
    width: 19,
    height: 10.5,
  },
  {
    roomN: 10,
    label: "Гостевая спальня",
    floor: 1,
    left: 74.5,
    top: 65,
    width: 19,
    height: 18,
  },
  {
    roomN: 11,
    label: "Гардеробная",
    floor: 1,
    left: 69,
    top: 83,
    width: 12,
    height: 9,
  },
  {
    roomN: 12,
    label: "Санузел",
    floor: 1,
    left: 81,
    top: 83,
    width: 12,
    height: 14,
  },
];
