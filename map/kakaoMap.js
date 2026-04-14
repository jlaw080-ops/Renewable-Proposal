// map/kakaoMap.js
// 주소 검색 모듈 — OpenStreetMap Nominatim 기반 (카카오맵 대체)

(function() {
  "use strict";

  var selectedLocation = null;

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

  function resolveRegionFromNominatim(nominatimResult) {
    var addr = nominatimResult.address || {};
    var state = addr.state || addr.province || '';
    var county = addr.county || addr.city_district || addr.city || '';

    // 강원 영동/영서 구분
    if (state.indexOf('강원') >= 0) {
      for (var i = 0; i < 강원영동.length; i++) {
        if (county.indexOf(강원영동[i]) >= 0) return '강원 영동';
      }
      return '강원 영서';
    }

    // 세종 포함 충남
    if (state.indexOf('세종') >= 0) return '충청남도·세종특별자치시';

    return 시도매핑[state] || null;
  }

  // 지도 초기화 (컨테이너 숨김 처리)
  function init(containerId) {
    var container = document.getElementById(containerId);
    if (container) {
      container.style.display = 'none';
    }
  }

  function searchAddress(keyword) {
    if (!keyword) return;

    var infoEl = document.getElementById('map-location-info');
    var addrEl = document.getElementById('map-selected-address');
    if (addrEl) addrEl.textContent = '검색 중...';
    if (infoEl) infoEl.style.display = 'block';

    var url = 'https://nominatim.openstreetmap.org/search?q='
      + encodeURIComponent(keyword)
      + '&format=json&countrycodes=kr&limit=1&accept-language=ko&addressdetails=1';

    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || data.length === 0) {
          alert('검색 결과가 없습니다: ' + keyword);
          if (infoEl) infoEl.style.display = 'none';
          return;
        }

        var result = data[0];
        var lat = parseFloat(result.lat);
        var lng = parseFloat(result.lon);

        // 한국어 주소 조합
        var addr = result.address || {};
        var parts = [];
        if (addr.state) parts.push(addr.state);
        if (addr.county || addr.city_district) parts.push(addr.county || addr.city_district);
        if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
        var fullAddress = parts.length > 0 ? parts.join(' ') : result.display_name;

        var region = resolveRegionFromNominatim(result);

        selectedLocation = { lat: lat, lng: lng, address: fullAddress, region: region };
        updateLocationUI();
        syncToMainForm();
      })
      .catch(function(err) {
        console.error('[Map] Nominatim 검색 오류:', err);
        alert('주소 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        if (infoEl) infoEl.style.display = 'none';
      });
  }

  function updateLocationUI() {
    var addrEl = document.getElementById('map-selected-address');
    var coordEl = document.getElementById('map-selected-coords');
    var regionEl = document.getElementById('map-selected-region');
    var infoEl = document.getElementById('map-location-info');

    if (addrEl && selectedLocation) addrEl.textContent = selectedLocation.address || '-';
    if (coordEl && selectedLocation) coordEl.textContent = selectedLocation.lat.toFixed(6) + ', ' + selectedLocation.lng.toFixed(6);
    if (regionEl && selectedLocation) {
      regionEl.textContent = selectedLocation.region || '매핑 불가 (수동으로 대지위치 선택)';
      regionEl.style.color = selectedLocation.region ? 'var(--color-pass)' : 'var(--color-fail)';
    }
    if (infoEl) infoEl.style.display = selectedLocation ? 'block' : 'none';
  }

  function syncToMainForm() {
    if (!selectedLocation || !selectedLocation.region) return;
    var sel = document.getElementById('sel-대지위치');
    if (sel) {
      sel.value = selectedLocation.region;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  window.KakaoMapModule = {
    init: init,
    search: searchAddress,
    getLocation: function() { return selectedLocation; },
    syncToForm: syncToMainForm
  };
})();
