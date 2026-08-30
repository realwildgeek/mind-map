// web/src/api/index.js
// 目前先写死一个固定的脑图 ID 用于跑通测试，后续可以动态传入
const API_URL = '/api/map/my-first-map';

// 从 R2 获取数据
export const getData = async () => {
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      return await res.json();
    }
    console.warn('R2 无数据或报错，将使用默认空白节点');
    return null;
  } catch (error) {
    console.error('获取 R2 数据失败', error);
    return null;
  }
};

// 存储数据到 R2
export const storeData = async (data) => {
  try {
    const res = await fetch(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      console.log('数据已静默同步至 R2');
    }
  } catch (error) {
    console.error('同步至 R2 失败', error);
  }
};

// 官方 UI 还会保存一些界面的本地配置（如侧边栏是否展开、当前选择的语言等）
// 这部分配置不需要上云，我们保留其原生的 localStorage 逻辑
export const storeConfig = (config) => {
  try {
    window.localStorage.setItem('simpleMindMapConfig', JSON.stringify(config))
  } catch (error) {
    console.log(error)
  }
}

export const getConfig = () => {
  try {
    const res = window.localStorage.getItem('simpleMindMapConfig')
    return res ? JSON.parse(res) : null
  } catch (error) {
    console.log(error)
    return null
  }
}
