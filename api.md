# 创建 PLSB 对象

## 【旧版接口】生成 POI（点）

```
ps.emitMessage({
  "type":     "spawn-POI",
  "location": "X=18086 Y=1223779 Z=5204",   // cm
  "icon":     "\uE999",
  "title":    "POI点的标题",  // 可为空
  "color":    "R=1 G=1 B=1 A=1",  // 0 ~ 1
  "shape":    "0",
  "id":       "poi001",
})

// 飞过去
ps.emitMessage({
  "type": "flyToIndex",
  "id":   "X=18086 Y=1223779 Z=5204"
})
```

- 类型：固定字符串“spawn-POI”。
- 坐标：单位 cm，需要将经纬度海拔转成三维空间中的 XYZ。
- 图标：传一个 Unicode 字符（预先自定义字体图标库）。
- 标题：POI 图标旁边展示的标题。
- 颜色：POI 点的主题颜色。
- 形状：0 菱形，1 圆形，2 圆角方形。

## 生成 POI（点）

```
ps.emitMessage([
    "spawn-POI",
    "location: X=18086 Y=1223779 Z=5204", // cm
    "icon:\uE998",  // char
    "title:POI标题",    // string
    "color: R=0 G=1 B=.5",   // 0~1
    "shape:2",  // 0、1、2
    "id:poi001",
].join('\r\n'));

// 飞过去
ps.emitMessage({
  "type": "flyToIndex",
  "id":   "X=18086 Y=1223779 Z=5204"
})
```

- 类型：固定字符串“spawn-POI”。
- 坐标：单位 cm，需要将经纬度海拔转成三维空间中的 XYZ。
- 图标：传一个 Unicode 字符（预先自定义字体图标库）。
- 标题：POI 图标旁边展示的标题。
- 颜色：POI 点的主题颜色。
- 形状：0 菱形，1 圆形，2 圆角方形。

## 生成路径（线）

```
ps.emitMessage([
    "spawn-path",
    "points: X=0 Y=0 Z=1500; X=-1000 Y=0 Z=2000; X=0 Y=0 Z=0; X=1000 Y=0 Z=2000; X=0 Y=0 Z=1500",   // cm
    "location: X=15702 Y=1160912 Z=5500", // cm
    "width:100",    // cm
    "material:0",    // int
    "color: R=0 G=1 B=1 A=.5",   // 0~1
    "id:path001",
].join('\r\n'));

// 飞过去
ps.emitMessage({
  "type": "flyToIndex",
  "id":   "X=15702 Y=1160912 Z=5500"
 })
```

- 类型：固定字符串“spawn-path”。
- 点集：分号";"分隔的三维坐标，提供一系列点坐标，连接成一段曲线。
- 位置：整体的三维坐标。
- 宽度：路径线条的宽度。
- 材质：选择样式编号。
- 颜色：材质的自定义 RGBA 通道。

## 生成区域围栏（面）

```
ps.emitMessage([
    "spawn-area",
    "points: X=1000 Y=0;  X=-809 Y=588;  X=309 Y=-951;  X=309 Y=951;  X=-809 Y=-588",   // cm
    "location: X=15702 Y=1260912 Z=5200", // cm
    "height:300",    // cm
    "material:0",    // int
    "color: R=0 G=1 B=1 A=.1",   // 0~1
    "id:area001",
].join('\r\n'));

// 飞过去
ps.emitMessage({
  "type": "flyToIndex",
  "id":   "X=15702 Y=1260912 Z=5200"
 })
```

- 类型：固定字符串“spawn-area”。
- 坐标：以分号";"分隔的水平坐标 XY，代表二维区域的每个端点。
- 颜色：高亮的颜色（RGBA 通道）。
- 材质：选择区域轮廓的样式编号。
- 高度：“围栏”的高度。
- 位置：三维空间中 XYZ 坐标（需要从经纬海拔转换）。

## 生成动画特效（面）

```
ps.emitMessage([
    "spawn-VFX",
    "location: X=16772 Y=1264692 Z=5230", // cm
    "scale:1.0",    // float
    "texture:0",    // int
    "period: 1.0",   // s
    "id:vfx001",
].join('\r\n'));

// 飞过去
ps.emitMessage({
  "type": "flyToIndex",
  "id":   "X=16772 Y=1264692 Z=5230"
})
```

- 类型：固定字符串“spawn-VFX”。
- 动图：选择图片编号。
- 位置：三维空间中 XYZ 坐标（需要从经纬海拔转换）。
- 尺寸：无需传参，等于图片本身的宽高（1px=1cm）。
- 缩放：根据序列帧尺寸的缩放倍数。
- 周期：序列帧播放一遍的时间。

## 生成模型（体）

```
ps.emitMessage([
    "spawn-mesh",
    "location: X=16772 Y=1269692 Z=5230", // cm
    "scale:1.0",    // float
    "mesh:0",    // int
    "id:mesh001",
].join('\r\n'));

// 飞过去
ps.emitMessage({
  "type": "flyToIndex",
  "id":   "X=16772 Y=1269692 Z=5230"
})
```

- 类型：固定字符串“spawn-mesh”。
- 模型：选择模型编号。
- 位置：三维空间中 XYZ 坐标（需要从经纬海拔转换）。
- 缩放：模型整体的缩放倍数。
- 动画：开发中。

# 定位

## 飞向目标

```
ps.emitMessage({
  "type": "FlyToPOIs",
  "id":   "..."  // 填入目标对象的标签
})
```

请参考《内置对象的标签》

## 飞向位置

```
ps.emitMessage({
  "type": "flyToIndex",
  "id":   "X=18086 Y=1223779 Z=5204"   // 三维
  // "id":  "0.5",  // 一维
})
```

传入三维坐标或者全桥百分比

## 请求当前在全桥的位置（百分比）

```
ps.emitMessage("get-location")
```

返回值参考《接收当前位置》

# 其他

## 监听消息

```
ps.addEventListener("message", e=>{
  alert(e.detail)
})
```

监听后台三维程序返回的字符串，设置回调函数。

## 隐藏所有点线面体

```
ps.emitMessage("hideAllPOI");
```

隐藏场景中所有的 PLSB 对象。

## 退出后台三维程序

谨慎操作！

```
ps.emitMessage("exit")

```

## 全桥漫游

```
ps.emitMessage({
  "type": "travel",
  "id":   "1.0"   // 实数
})

```

- 正数： 向东漫游。
- 负数： 向西漫游。
- 零： 停止。
- 绝对值： 速率倍数。
- 单位速率：30km/90s。

## 销毁对象

```
ps.emitMessage({
  "type":   "destroy",
  "id":     "..."   // 任意对象的标签
})
```

## 修改旋转半径

传入新的旋转半径：100 到 100000 之间

```
ps.emitMessage({
  "type":   "zoom",
  "id":     "1000"  // cm
})
```

# 《参考文档》

## 《快捷键》

先点击画面聚焦，再尝试以下热键：

- Esc： 切换菜单。
- B 键： 回到初始位置。
- 0-9： 飞到全桥从西向东 0%-90% 的位置。
- 左右键：全桥漫游。
- WSADEQ：前后左右上下。

## 《鼠标操作》

- 单击： 点击事件。
- 左键拖拽：平移。
- 右键拖拽：绕焦点旋转。
- 中间： 更新焦点。
- 滚轮： 缩放。

## 《接收当前位置》

靠近某个浮空地标，或者主动请求时，会监听到该消息。

```
{
  "type":     "location",
  "percent":  "0~1 间的小数"
}
```

## 《内置对象的标签》

bee：Disease_1、Disease_2、Disease_3、Disease_4

camera：8、9、10、11、12、13、14、15、16、17

onSensorClick：
RHS：7416、7417
ULT：7316、7317
VIC：9000、9004
VIB：2060、2062
GPS：12480、12491

其他：T-L6-080201、1、2、3、4、5、6、7

定位：
QingZhouQiao
JiangHaiQiao
JiuZhouQiao
DongFei
XiFei
AnQiaoKouAn
QingBaoBan

## 《点击 POI 返回》

请点击场景中的 POI 点，查看返回格式。

```
{
  "type": "poi",
  "0":    "POI 的 id"
  "1":    "标签1"
  "2":    "标签2"
  // ......
}
```
