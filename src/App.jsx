import React, { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-control-geocoder/dist/Control.Geocoder.css'
import 'leaflet-control-geocoder'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import markerIcon from './img/map.png'
import polyline from '@mapbox/polyline'
import './App.css'

const customIcon = new L.Icon({
	iconUrl: markerIcon,
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
})

const MapComponent = ({
	markers,
	setMarkers,
	setErrorMessage,
	addMarker,
	setMapInstance,
}) => {
	const map = useMap()

	// 將地圖實例傳回 App
	useEffect(() => {
		setMapInstance(map)
	}, [map, setMapInstance])

	// 地圖搜尋控制元件 geocoderControl
	useEffect(() => {
		if (!map.geocoderAdded) {
			const geocoderControl = L.Control.geocoder({
				defaultMarkGeocode: false,
				geocoder: L.Control.Geocoder.nominatim(),
			})
				.on('markgeocode', function (e) {
					const { center, name } = e.geocode
					addMarker({
						lat: center.lat,
						lng: center.lng,
						name: name || '未知地點',
					})
				})
				.addTo(map)
			map.geocoderAdded = true
		}
	}, [map, addMarker])

	return (
		<>
			<TileLayer
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
			/>
			{markers.map((marker, index) => (
				<Marker
					key={index}
					position={[marker.lat, marker.lng]}
					icon={customIcon}
				/>
			))}
		</>
	)
}

const App = () => {
	const [markers, setMarkers] = useState([])
	const [errorMessage, setErrorMessage] = useState('')
	const [searchResults, setSearchResults] = useState([]) // 儲存搜尋結果
	const [selectedMarkers, setSelectedMarkers] = useState([]) // 儲存選中的標記
	const [map, setMap] = useState(null) // 存放地圖實例
	const [transportMode, setTransportMode] = useState('driving') // 運輸模式：駕車、騎車、步行
	const routeLineRef = useRef(null) // 用來儲存目前的路徑

	// 計算路徑（僅在按下「顯示最佳路徑」時觸發）
	const calculateRoute = (coordinates, map, mode) => {
		const url = `https://router.project-osrm.org/route/v1/${mode}/${coordinates.join(
			';'
		)}?steps=true&geometries=polyline`

		fetch(url)
			.then((response) => response.json())
			.then((data) => {
				if (data.routes && data.routes.length > 0) {
					const route = data.routes[0]
					const routeCoordinates = polyline
						.decode(route.geometry)
						.map((point) => L.latLng(point[0], point[1]))

					// 清除舊路徑（若存在）
					if (routeLineRef.current) {
						map.removeLayer(routeLineRef.current)
					}

					// 畫出新路徑
					const routeLine = L.polyline(routeCoordinates, {
						color: 'blue',
						weight: 5,
					}).addTo(map)
					map.fitBounds(routeLine.getBounds())

					// 儲存目前的路徑
					routeLineRef.current = routeLine
				} else {
					setErrorMessage('無法計算路徑')
				}
			})
			.catch((error) => {
				console.error('發生錯誤:', error)
				setErrorMessage('無法聯繫 OSRM 伺服器')
			})
	}

	// 顯示路徑（按下按鈕後觸發）
	const handleShowRoute = () => {
		if (markers.length < 2) {
			setErrorMessage('請選擇至少兩個地點')
			return
		}
		if (!map) {
			setErrorMessage('地圖尚未初始化')
			return
		}
		const coordinates = markers.map((marker) => `${marker.lng},${marker.lat}`)
		calculateRoute(coordinates, map, transportMode)
	}

	// 處理搜尋地址
	const handleAddLocation = () => {
		const locationName = prompt('輸入地點名稱 (例如: 台北車站)')
		if (!locationName) return

		const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
			locationName
		)}&limit=5&format=json&addressdetails=1`

		fetch(url)
			.then((response) => response.json())
			.then((results) => {
				if (results && results.length > 0) {
					const locationList = results.map((result, index) => ({
						name: result.display_name || `位置 ${index + 1}`,
						lat: parseFloat(result.lat),
						lng: parseFloat(result.lon),
						fullLocation: result.display_name,
					}))
					setSearchResults(locationList)
					setErrorMessage('')
				} else {
					setErrorMessage('找不到這個地點')
				}
			})
			.catch((error) => {
				console.error('發送請求時發生錯誤:', error)
				setErrorMessage('請求發生錯誤')
			})
	}

	// 點選搜尋結果中的地點
	const handleSelectLocation = (lat, lng, name) => {
		addMarker({ lat, lng, name })
		setSearchResults([]) // 清空搜尋結果
	}

	// 添加標記（同時更新 localStorage）
	const addMarker = (location) => {
		const newMarkers = [...markers, location]
		setMarkers(newMarkers)
		localStorage.setItem('savedLocations', JSON.stringify(newMarkers))
	}

	// 清除選中的標記
	const handleClearSelectedMarkers = () => {
		const filteredMarkers = markers.filter(
			(marker) => !selectedMarkers.includes(marker.name)
		)
		setMarkers(filteredMarkers)
		setSelectedMarkers([])
		localStorage.setItem('savedLocations', JSON.stringify(filteredMarkers))
	}

	// 切換標記選中狀態
	const toggleSelectMarker = (markerName) => {
		setSelectedMarkers((prevSelectedMarkers) =>
			prevSelectedMarkers.includes(markerName)
				? prevSelectedMarkers.filter((name) => name !== markerName)
				: [...prevSelectedMarkers, markerName]
		)
	}

	// 清除所有標記
	const handleClearMarkers = () => {
		setMarkers([])
		setSelectedMarkers([])
		localStorage.removeItem('savedLocations')
	}

	// 拖曳變更標記順序
	const handleDragEnd = (result) => {
		if (!result.destination) return
		const reorderedMarkers = [...markers]
		const [movedItem] = reorderedMarkers.splice(result.source.index, 1)
		reorderedMarkers.splice(result.destination.index, 0, movedItem)
		setMarkers(reorderedMarkers)
		localStorage.setItem('savedLocations', JSON.stringify(reorderedMarkers))
	}

	// 讀取已儲存的位置
	useEffect(() => {
		try {
			const storedLocations =
				JSON.parse(localStorage.getItem('savedLocations')) || []
			if (Array.isArray(storedLocations)) {
				setMarkers(
					storedLocations.filter(
						(loc) =>
							loc &&
							typeof loc === 'object' &&
							'lat' in loc &&
							'lng' in loc &&
							'name' in loc
					)
				)
			} else {
				setMarkers([])
			}
		} catch (error) {
			console.error('讀取 localStorage 錯誤:', error)
			setMarkers([])
		}
	}, [])

	return (
		<div className="container">
			<div className="sidebar">
				<button onClick={handleAddLocation}>新增地點</button>
				<button onClick={handleClearMarkers}>清除所有地點</button>
				<button onClick={handleClearSelectedMarkers}>清除選中地點</button>
				<div>
					<select
						value={transportMode}
						onChange={(e) => setTransportMode(e.target.value)}
					>
						<option value="driving">駕車</option>
						<option value="cycling">騎車</option>
						<option value="walking">步行</option>
					</select>
					<button onClick={handleShowRoute}>
						顯示最佳路徑(新增/刪除地點請重新點擊)
					</button>
				</div>
				{errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

				{searchResults.length > 0 && (
					<div>
						<h3>搜尋結果</h3>
						<ul>
							{searchResults.map((result, index) => (
								<li
									key={index}
									onClick={() =>
										handleSelectLocation(
											result.lat,
											result.lng,
											result.fullLocation
										)
									}
								>
									{result.fullLocation}
								</li>
							))}
						</ul>
					</div>
				)}

				<DragDropContext onDragEnd={handleDragEnd}>
					<Droppable droppableId="locations">
						{(provided) => (
							<ul {...provided.droppableProps} ref={provided.innerRef}>
								{markers.map((marker, index) => (
									<Draggable
										key={index}
										draggableId={index.toString()}
										index={index}
									>
										{(provided) => (
											<li
												ref={provided.innerRef}
												{...provided.draggableProps}
												{...provided.dragHandleProps}
											>
												<input
													type="checkbox"
													checked={selectedMarkers.includes(marker.name)}
													onChange={() => toggleSelectMarker(marker.name)}
												/>
												📍 {marker.name} ({marker.lat.toFixed(5)},{' '}
												{marker.lng.toFixed(5)})
											</li>
										)}
									</Draggable>
								))}
								{provided.placeholder}
							</ul>
						)}
					</Droppable>
				</DragDropContext>
			</div>

			<div className="map">
				<MapContainer
					center={[25.033, 121.565]}
					zoom={12}
					style={{ height: '100%', width: '100%' }}
					whenCreated={setMap}
				>
					<MapComponent
						markers={markers}
						setMarkers={setMarkers}
						setErrorMessage={setErrorMessage}
						addMarker={addMarker}
						setMapInstance={setMap}
					/>
				</MapContainer>
			</div>
		</div>
	)
}

export default App
