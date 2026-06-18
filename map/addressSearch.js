// map/addressSearch.js
// 주소 검색 모듈 — 네이버 지도 Geocoding API (서버 프록시 /api/geocode)
// CORS 제한으로 클라이언트 직접 호출 불가 → Vercel Edge Function 프록시 경유

(function() {
  "use strict";

  var selectedLocation = null;

  var 시도매핑 = {
    "서울": "서울특별시", "서울특별시": "서울특별시", "서울시": "서울특별시",
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

  function resolveRegionFromNaver(addrElements) {
    var sido = '';
    var sigugun = '';

    for (var i = 0; i < addrElements.length; i++) {
      var el = addrElements[i];
      var types = el.types || [];
      if (types.indexOf('SIDO') >= 0) sido = el.longName;
      if (types.indexOf('SIGUGUN') >= 0) sigugun = el.longName;
    }

    // 강원 영동/영서 구분
    if (sido.indexOf('강원') >= 0) {
      for (var j = 0; j < 강원영동.length; j++) {
        if (sigugun.indexOf(강원영동[j]) >= 0) return '강원 영동';
      }
      return '강원 영서';
    }

    // 세종 포함 충남
    if (sido.indexOf('세종') >= 0) return '충청남도·세종특별자치시';

    return 시도매핑[sido] || null;
  }

  // 지도 컨테이너 숨김 처리 (지도 SDK 미사용)
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

    var url = '/api/geocode?query=' + encodeURIComponent(keyword);

    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || !data.addresses || data.addresses.length === 0) {
          alert('검색 결과가 없습니다: ' + keyword);
          if (infoEl) infoEl.style.display = 'none';
          return;
        }

        var addr = data.addresses[0];
        var lat = parseFloat(addr.y);
        var lng = parseFloat(addr.x);
        var fullAddress = addr.roadAddress || addr.jibunAddress || keyword;
        var region = resolveRegionFromNaver(addr.addressElements || []);

        selectedLocation = { lat: lat, lng: lng, address: fullAddress, region: region };
        updateLocationUI();
        syncToMainForm();
      })
      .catch(function(err) {
        console.error('[AddressSearch] 네이버 Geocoding 검색 오류:', err);
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

  window.AddressSearchModule = {
    init: init,
    search: searchAddress,
    getLocation: function() { return selectedLocation; },
    syncToForm: syncToMainForm
  };
})();
