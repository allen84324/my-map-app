import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-control-geocoder/dist/Control.Geocoder.css'
import 'leaflet-control-geocoder'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const customIcon = new L.Icon({
	iconUrl: markerIcon,
	shadowUrl: markerShadow,
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
})

const MapComponent = () => {
	const [markers, setMarkers] = useState([])
	const [errorMessage, setErrorMessage] = useState('')
	const [searchResults, setSearchResults] = useState([]) // 儲存搜尋結果
	const [selectedMarkers, setSelectedMarkers] = useState([]) // 儲存選中的標記

	// 地圖搜尋控制元件
	const AddGeocoder = () => {
		const map = useMap()

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
		}, [map])

		return null
	}

	// 添加標記
	const addMarker = (location) => {
		const newMarkers = [...markers, location]
		setMarkers(newMarkers)
		localStorage.setItem('savedLocations', JSON.stringify(newMarkers))
	}

	// 處理搜尋地址
	const handleAddLocation = () => {
		const locationName = prompt('輸入地點名稱 (例如: 台北車站)')
		if (!locationName) return

		// 發送請求到 Nominatim API
		const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
			locationName
		)}&limit=5&format=json&addressdetails=1`

		fetch(url)
			.then((response) => response.json())
			.then((results) => {
				if (results && results.length > 0) {
					// 儲存搜尋結果
					const locationList = results.map((result, index) => ({
						name: result.display_name || `位置 ${index + 1}`,
						lat: parseFloat(result.lat),
						lng: parseFloat(result.lon),
						fullLocation: result.display_name,
					}))
					setSearchResults(locationList) // 更新搜尋結果狀態
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

	// 點選選擇地點
	const handleSelectLocation = (lat, lng, name) => {
		addMarker({
			lat,
			lng,
			name,
		})
		setSearchResults([]) // 清空搜尋結果
	}

	// 清除選中的標記
	const handleClearSelectedMarkers = () => {
		const filteredMarkers = markers.filter(
			(marker) => !selectedMarkers.includes(marker.name)
		)
		setMarkers(filteredMarkers)
		setSelectedMarkers([]) // 清空選中的標記
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

	// 清除標記
	const handleClearMarkers = () => {
		setMarkers([])
		setSelectedMarkers([]) // 清空選中的標記
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
		<div
			style={{
				textAlign: 'center',
				display: 'flex',
				flexDirection: 'row',
				justifyContent: 'center',
				gap: '20px',
			}}
		>
			{/* 控制按鈕 & 清單 */}
			<div>
				<button onClick={handleAddLocation}>新增地點</button>
				<button onClick={handleClearMarkers}>清除所有地點</button>
				<button onClick={handleClearSelectedMarkers}>清除選中地點</button>
				{errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}

				{/* 顯示搜尋結果 */}
				{searchResults.length > 0 && (
					<div>
						<h3>搜尋結果</h3>
						<ul style={{ listStyleType: 'none', padding: 0 }}>
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
									style={{
										padding: '10px',
										background: '#f0f0f0',
										margin: '5px 0',
										cursor: 'pointer',
										color: 'black',
									}}
								>
									{result.fullLocation}
								</li>
							))}
						</ul>
					</div>
				)}

				{/* 可拖曳地點列表 */}
				<DragDropContext onDragEnd={handleDragEnd}>
					<Droppable droppableId="locations">
						{(provided) => (
							<ul
								{...provided.droppableProps}
								ref={provided.innerRef}
								style={{ listStyle: 'none', padding: 0 }}
							>
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
												style={{
													padding: '10px',
													margin: '5px 0',
													background: '#f0f0f0',
													borderRadius: '5px',
													color: 'black',
													cursor: 'grab',
													...provided.draggableProps.style,
												}}
											>
												<input
													type="checkbox"
													checked={selectedMarkers.includes(marker.name)}
													onChange={() => toggleSelectMarker(marker.name)}
													style={{ marginRight: '10px' }}
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

			{/* 地圖 */}
			<MapContainer
				center={[25.033, 121.565]}
				zoom={12}
				style={{
					height: '500px',
					width: '700px',
					display: 'block',
				}}
			>
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
				<AddGeocoder />
			</MapContainer>
		</div>
	)
}

export default MapComponent
