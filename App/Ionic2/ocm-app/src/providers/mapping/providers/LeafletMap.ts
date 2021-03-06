﻿import { GeoPosition, GeoLatLng, GeoBounds } from './../../../model/GeoPosition';
import { Logging, LogLevel } from './../../Logging';
/**
* @author Christopher Cook
* @copyright Webprofusion Ltd http://webprofusion.com
*/
import { Utils } from '../../../core/Utils';
import { MappingAPI, IMapProvider, MapOptions, Mapping } from '../Mapping';
import { Events } from 'ionic-angular';
import { Observable } from 'rxjs/Observable';
import * as collections from 'typescript-collections';

declare var L: any;
declare var google:any;

/**Map Provider for Leaflet API
* @module MapProviders
*/
export class LeafletMap implements IMapProvider {
    mapAPIType: MappingAPI;
    mapReady: boolean;
    providerError: string;
    mapCanvasID: string;

    private map: L.Map;
    private markerList: collections.Dictionary<number, any>;


    /** @constructor */
    constructor(private events: Events, private logging: Logging) {
        this.events = events;
        this.mapAPIType = MappingAPI.LEAFLET;
        this.mapReady = false;
        this.markerList = new collections.Dictionary<number, google.maps.Marker>();
    }

    /**
    * Performs one-time init of map object for this map provider
    * @param mapcanvasID  dom element for map canvas
    * @param mapConfig  general map config/options
    
    */
    initMap(mapCanvasID, mapConfig: MapOptions, parentMapManager: Mapping) {
        this.mapCanvasID = mapCanvasID;

        var apiLoaded = true;
        if (typeof L === 'undefined') {
            apiLoaded = false;
        }

        if (apiLoaded) {
            if (this.map == null) {
                var mapCanvas = document.getElementById(mapCanvasID);

                if (mapCanvas != null) {
                    this.map = L.map(mapCanvasID).setView(new L.LatLng(51.505, -0.09), 13);

                    /*var t = new L.TileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    });*/

                    (<any>L.tileLayer).provider('Stamen.Watercolor').addTo(this.map);
                    //(<any>L.tileLayer).provider('Thunderforest.Transport').addTo(this.map);
                    //(<any>L.tileLayer).provider('Esri.WorldShadedRelief').addTo(this.map);
                    //(<any>L.tileLayer).provider('CartoDB.DarkMatter').addTo(this.map);


                    //this.map.addLayer(t);

                    mapCanvas.style.width = '100%';
                    mapCanvas.style.height = Utils.getClientHeight().toString();
                    this.logging.log("Defaulted map height to " + Utils.getClientHeight());

                    //events for map manipulation to perform search
                    var providerContext = this;
                    this.map.on('moveend', () => {
                        providerContext.events.publish('ocm:mapping:dragend');
                    });
                    this.map.on('zoomend', () => {
                        providerContext.events.publish('ocm:mapping:zoom');
                    });

                    this.mapReady = true;

                    this.events.publish('ocm:mapping:ready');
                }
            }
        }
        else {
            this.logging.log("Call to initMap before API is ready:" + MappingAPI[this.mapAPIType], LogLevel.ERROR);

            this.mapReady = false;
            return false;
        }
    }

    /** Clear current markers */
    clearMarkers() {
        if (this.markerList != null) {
            this.logging.log("Clearing all markers [" + this.markerList.size() + "]");
            for (var i = 0; i < this.markerList.size(); i++) {
                if (this.markerList[i]) {
                    this.markerList[i].setMap(null);
                }
            }
        }
        this.markerList = new collections.Dictionary<number, any>();
    }
    /**
    * Renders the given array of POIs as map markers
    * @param poiList  array of POI objects
    * @param parentContext  parent app context
    */
    showPOIListOnMap(poiList: Array<any>, parentContext: any) {

        var clearMarkersOnRefresh = false;
        var map = this.map;
        var bounds = new google.maps.LatLngBounds();
        var markersAdded = 0;
        var mapProviderContext = this;

        //clear existing markers (if enabled)
        if (clearMarkersOnRefresh == true) {
            this.clearMarkers();
        }
        var mapzoom = map.getZoom();

        if (poiList != null) {
            //render poi markers



            var poiCount = poiList.length;
            for (var i = 0; i < poiList.length; i++) {
                if (poiList[i].AddressInfo != null) {
                    if (poiList[i].AddressInfo.Latitude != null && poiList[i].AddressInfo.Longitude != null) {
                        var poi = poiList[i];

                        var addMarker = true;
                        if (!clearMarkersOnRefresh && this.markerList != null) {
                            //find if this poi already exists in the marker list
                            if (this.markerList.containsKey(poi.ID)) {
                                addMarker = false;

                                //set marker scale based on zoom?
                                //var m = this.markerList.getValue(poi.ID);
                                //if (m.set())
                            }
                        }

                        if (addMarker) {
                            var poiLevel = Utils.getMaxLevelOfPOI(poi);

                            var iconURL = null;
                            var animation = null;
                            var shadow = null;
                            var markerImg = null;

                            iconURL = "images/icons/map/level" + poiLevel;
                            if (poi.UsageType != null && poi.UsageType.Title.indexOf("Private") > -1) {
                                iconURL += "_private";
                            } else if (poi.StatusType != null && poi.StatusType.IsOperational != true) {
                                iconURL += "_nonoperational";
                            } else {
                                iconURL += "_operational";
                            }

                            iconURL += "_icon.png";

                            var defaultMarkerIcon = L.icon({
                                iconUrl: iconURL,

                                iconSize: [34, 50], // size of the icon
                                iconAnchor: [15, 45] // point of the icon which will correspond to marker's location
                                // popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
                            });

                            var markerTooltip = "OCM-" + poi.ID + ": " + poi.AddressInfo.Title + ":";
                            if (poi.UsageType != null) markerTooltip += " " + poi.UsageType.Title;
                            if (poiLevel > 0) markerTooltip += " Level " + poiLevel;
                            if (poi.StatusType != null) markerTooltip += " " + poi.StatusType.Title;

                            var marker = <any>new L.Marker(
                                new L.LatLng(poi.AddressInfo.Latitude, poi.AddressInfo.Longitude),
                                <L.MarkerOptions>{
                                    icon: defaultMarkerIcon, title: markerTooltip, draggable: false, clickable: true
                                });

                            marker._isClicked = false; //workaround for double click event
                            marker.poi = poi;
                            marker.on('click',
                                function (e) {
                                    if (this._isClicked == false) {
                                        this._isClicked = true;
                                        //appcontext.showDetailsView(anchorElement, this.poi);
                                        //appcontext.showPage("locationdetails-page");
                                        if (console) console.log("POI clicked:" + this.poi.ID);

                                        mapProviderContext.events.publish('ocm:poi:selected', { poi: poi, poiId: poi.ID });

                                        //workaround double click event by clearing clicked state after short time
                                        //var mk = this;
                                        //setTimeout(function () { mk._isClicked = false; }, 300);
                                    }
                                });

                            // markerClusterGroup.addLayer(marker);
                            marker.addTo(this.map);
                            this.markerList.setValue(poi.ID, marker);
                            markersAdded++;
                        }
                    }
                }
            }

            this.logging.log(markersAdded + " new map markers added out of a total " + this.markerList.size());
        }

        var uiContext = this;
        //zoom to bounds of markers
        /*
                if (poiList != null && poiList.length > 0) {
                    if (parentContext != null && !parentContext.appConfig.enableLiveMapQuerying) {
                        this.logging.log("Fitting to marker bounds:" + bounds);
                        map.setCenter(bounds.getCenter());
                        this.logging.log("zoom before fit bounds:" + map.getZoom());
        
                        map.fitBounds(bounds);
        
                        //fix incorrect zoom level when fitBounds guesses a zooom level of 0 etc.
                        var zoom = map.getZoom();
                        map.setZoom(zoom < 6 ? 6 : zoom);
                    } else {
                        if (map.getCenter() == undefined) {
                            map.setCenter(bounds.getCenter());
                        }
                    }
                }
        */

        //this.refreshMapLayout();
    }

    refreshMapLayout() {
        if (this.map != null) {


        }
    }

    setMapCenter(pos: GeoPosition) {
        if (this.mapReady) {
            // this.map.setCenter(new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude));
        }
    };

    getMapCenter(): Observable<GeoPosition> {

        //wrap getCenter in an observable
        let obs = Observable.create(observer => {
            var pos = this.map.getCenter();
            observer.next(new GeoPosition(pos.lat, pos.lng));
            observer.complete();
        });

        return obs;
    }

    setMapZoom(zoomLevel: number) {
        if (this.mapReady) {
            this.map.setZoom(zoomLevel,{});
        }

    }

    getMapZoom(): Observable<number> {

        //wrap getzoom in an observable
        let obs = Observable.create(observer => {

            let zoom = this.map.getZoom();
            observer.next(zoom);
            observer.complete();

        });
        return obs;
    }

    setMapType(mapType: string) {
        /*try {
            this.map.setMapTypeId(eval("google.maps.MapTypeId." + mapType));
        } catch (exception) {
            this.logging.log("Failed to set map type:" + mapType + " : " + exception.toString());
        }*/
    }

    getMapBounds(): Observable<Array<GeoLatLng>> {
        //wrap getzoom in an observable
        let obs = Observable.create(observer => {

            var bounds = new Array<GeoLatLng>();

            var mapBounds = this.map.getBounds();
            bounds.push(new GeoLatLng(mapBounds.getNorthEast().lat, mapBounds.getNorthEast().lng));
            bounds.push(new GeoLatLng(mapBounds.getSouthWest().lat, mapBounds.getSouthWest().lng));


            observer.next(bounds);
            observer.complete();
        });
        return obs;
    }

    renderMap(poiList: Array<any>, mapHeight: number, parentContext: any): boolean {
        document.getElementById(this.mapCanvasID).style.height = mapHeight + "px";

        if (this.mapReady) {
            this.showPOIListOnMap(poiList, parentContext);
        }

        return true;
    }
    renderPolyline(polyline: string) {

        this.clearPolyline();
        //TODO
    }

    clearPolyline() {
        //TODO
    }

    moveToMapBounds(bounds: GeoBounds) {
        this.map.fitBounds(new L.LatLngBounds(
            { lat: bounds.southWest.latitude, lng: bounds.southWest.longitude },
            { lat: bounds.northEast.latitude, lng: bounds.northEast.longitude }
        ),{});
    }
    focusMap() {
        //
    }
    unfocusMap() {
        //
    }
}