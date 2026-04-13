// map/kakaoMap.js
// 카카오맵 통합 모듈 — 위치 선택, 주소 검색, 좌표→지역 매핑

(function() {
  "use strict";

  var map = null;
  var marker = null;
  var geocoder = null;
  var ps = null;
  var selectedLocation = null;
  var mapInitialized = false;
  var sdkReady = false;

  var 시도매핑 = {
    "서울": "서울특별시", "서울특별시": "서울특별시",
    "부산": "부산광역시", "부산광역시": "부산광역시",
    "대구": "대구광역시", "대구광역시": "대구광역시",
    "인천": "인천광역시", "인천광역시": "인천광역시",
    "광주": "광주광역시", "광주광역시": "광주광역시",
    "대전": "대전광역시", "대전광역시": "대전광역시",
    "울산": "울산광역시", "울산광역시": "울산광역시",
    "세종": "충청남도·세종특별자치시", "세종특별자치시": "충청남도·세종특별자치시",
    "경기": "경기도", "경기도": "경기도",
    "강원": "강원 영서", "강원도": "강원 영서", "강원특별자치도": "강원 영서",
    "충북": "충청북도", "충청북도": "충청북도",
    "충남": "충청남도·세종특별자치시", "충청남도": "충청남도·세종특별자치시",
    "전북": "전라북도", "전라북도": "전라북도", "전북특별자치도": "전라북도",
    "전남": "전라남도", "전라남도": "전라남도",
    "경북": "경상북도", "경상북도": "경상북도",
    "경남": "경상남도", "경상남도": "경상남도",
    "제주": "제주특별자치도", "제주특별자치도": "제주특별자치도", "제주도": "제주특별자치도"
  };

  var 강원영동 = ["강릉시","동해시","삼척시","속초시","양양군","고성군","태백시"];

  function resolveRegion(address) {
    if (!address) return null;
    var parts = address.split(" ");
    var sido = parts[0] || "";
    var sigungu = parts[1] || "";
    var mapped = 시도매핑[sido];
    if (!mapped) return null;
    if (sido.indexOf("강원") === 0) {
      for (var i = 0; i < 강원영동.length; i++) {
        if (sigungu.indexOf(강원영동[i]) >= 0) return "강원 영동";
      }
      return "강원 영서";
    }
    return mapped;
  }

  // SDK 로딩 대기 후 초기화
  function waitForSDK(callback) {
    if (typeof kakao !== "undefined" && kakao.maps) {
      sdkReady = true;
      callback();
      return;
    }
    // SDK 로딩 대기 (최대 10초)
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      if (typeof kakao !== "undefined" && kakao.maps) {
        clearInterval(timer);
        sdkReady = true;
        callback();
      } else if (attempts > 50) {
        clearInterval(timer);
        console.warn("[KakaoMap] SDK load timeout");
      }
    }, 200);
  }

  function initMap(containerId) {
    if (mapInitialized) {
      // 이미 초기화된 경우 relayout만
      if (map) {
        setTimeout(function() { map.relayout(); }, 100);
      }
      return;
    }

    waitForSDK(function() {
      kakao.maps.load(function() {
        var container = document.getElementById(containerId);
        if (!container) { console.warn("[KakaoMap] container not found:", containerId); return; }

        // 컨테이너가 보이는지 확인 (탭 활성화 후 호출되어야 함)
        var rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          console.warn("[KakaoMap] container not visible, retrying...");
          setTimeout(function() { initMap(containerId); }, 300);
          return;
        }

        var options = { center: new kakao.maps.LatLng(37.5665, 126.9780), level: 5 };
        map = new kakao.maps.Map(container, options);
        geocoder = new kakao.maps.services.Geocoder();
        ps = new kakao.maps.services.Places();

        kakao.maps.event.addListener(map, "click", function(mouseEvent) {
          var latlng = mouseEvent.latLng;
          placeMarker(latlng);
          reverseGeocode(latlng);
        });

        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        mapInitialized = true;
        console.log("[KakaoMap] initialized");
      });
    });
  }

  function placeMarker(latlng) {
    if (marker) { marker.setPosition(latlng); }
    else { marker = new kakao.maps.Marker({ position: latlng, map: map }); }
  }

  function reverseGeocode(latlng) {
    if (!geocoder) return;
    geocoder.coord2Address(latlng.getLng(), latlng.getLat(), function(result, status) {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        var addr = result[0].address;
        var fullAddress = addr.address_name;
        var region = resolveRegion(fullAddress);
        selectedLocation = { lat: latlng.getLat(), lng: latlng.getLng(), address: fullAddress, region: region };
        updateLocationUI();
        syncToMainForm();
      }
    });
  }

  function searchAddress(keyword) {
    if (!geocoder) {
      console.warn("[KakaoMap] geocoder not ready");
      return;
    }
    geocoder.addressSearch(keyword, function(result, status) {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        var coords = new kakao.maps.LatLng(result[0].y, result[0].x);
        map.setCenter(coords);
        map.setLevel(3);
        placeMarker(coords);
        reverseGeocode(coords);
      } else if (ps) {
        ps.keywordSearch(keyword, function(data, status2) {
          if (status2 === kakao.maps.services.Status.OK && data[0]) {
            var coords = new kakao.maps.LatLng(data[0].y, data[0].x);
            map.setCenter(coords);
            map.setLevel(3);
            placeMarker(coords);
            reverseGeocode(coords);
          } else {
            alert("검색 결과가 없습니다: " + keyword);
          }
        });
      }
    });
  }

  function updateLocationUI() {
    var addrEl = document.getElementById("map-selected-address");
    var coordEl = document.getElementById("map-selected-coords");
    var regionEl = document.getElementById("map-selected-region");
    if (addrEl && selectedLocation) addrEl.textContent = selectedLocation.address || "-";
    if (coordEl && selectedLocation) coordEl.textContent = selectedLocation.lat.toFixed(6) + ", " + selectedLocation.lng.toFixed(6);
    if (regionEl && selectedLocation) {
      regionEl.textContent = selectedLocation.region || "매핑 불가";
      regionEl.style.color = selectedLocation.region ? "var(--color-pass)" : "var(--color-fail)";
    }
    var infoEl = document.getElementById("map-location-info");
    if (infoEl) infoEl.style.display = selectedLocation ? "block" : "none";
  }

  function syncToMainForm() {
    if (!selectedLocation || !selectedLocation.region) return;
    var sel = document.getElementById("sel-대지위치");
    if (sel) {
      sel.value = selectedLocation.region;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function getSelectedLocation() { return selectedLocation; }

  window.KakaoMapModule = {
    init: initMap,
    search: searchAddress,
    getLocation: getSelectedLocation,
    syncToForm: syncToMainForm
  };
})();
