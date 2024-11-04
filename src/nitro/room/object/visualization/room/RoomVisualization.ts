import { RenderTexture, Resource, Texture } from '@pixi/core';
import { Rectangle } from '@pixi/math';
import { AdvancedMap } from '../../../../../core/utils/AdvancedMap';
import { AlphaTolerance } from '../../../../../room/object/enum/AlphaTolerance';
import { RoomObjectSpriteType } from '../../../../../room/object/enum/RoomObjectSpriteType';
import { IRoomObjectModel } from '../../../../../room/object/IRoomObjectModel';
import { IPlaneVisualization } from '../../../../../room/object/visualization/IPlaneVisualization';
import { IRoomObjectSprite } from '../../../../../room/object/visualization/IRoomObjectSprite';
import { IObjectVisualizationData } from '../../../../../room/object/visualization/IRoomObjectVisualizationData';
import { IRoomPlane } from '../../../../../room/object/visualization/IRoomPlane';
import { RoomObjectSpriteVisualization } from '../../../../../room/object/visualization/RoomObjectSpriteVisualization';
import { IRoomGeometry } from '../../../../../room/utils/IRoomGeometry';
import { Vector3d } from '../../../../../room/utils/Vector3d';
import { RoomMapData } from '../../RoomMapData';
import { RoomMapMaskData } from '../../RoomMapMaskData';
import { RoomObjectVariable } from '../../RoomObjectVariable';
import { RoomPlaneBitmapMaskData } from '../../RoomPlaneBitmapMaskData';
import { RoomPlaneBitmapMaskParser } from '../../RoomPlaneBitmapMaskParser';
import { RoomPlaneData } from '../../RoomPlaneData';
import { RoomPlaneParser } from '../../RoomPlaneParser';
import { RoomPlane } from './RoomPlane';
import { RoomVisualizationData } from './RoomVisualizationData';

export class RoomVisualization extends RoomObjectSpriteVisualization implements IPlaneVisualization
{
    public static LAST_VISUALIZATION: RoomVisualization = null;

    public static RENDER_TEXTURE_CACHE: Map<RoomVisualization, AdvancedMap<any, RenderTexture>> = new Map();

    public static FLOOR_COLOR: number = 0xFFFFFF;
    public static FLOOR_COLOR_LEFT: number = 0xDDDDDD;
    public static FLOOR_COLOR_RIGHT: number = 0xBBBBBB;
    private static WALL_COLOR_TOP: number = 0xFFFFFF;
    private static WALL_COLOR_SIDE: number = 0xCCCCCC;
    private static WALL_COLOR_BOTTOM: number = 0x999999;
    private static WALL_COLOR_BORDER: number = 0x999999;
    public static LANDSCAPE_COLOR_TOP: number = 0xFFFFFF;
    public static LANDSCAPE_COLOR_SIDE: number = 0xCCCCCC;
    public static LANDSCAPE_COLOR_BOTTOM: number = 0x999999;
    private static ROOM_DEPTH_OFFSET: number = 1000;

    protected _data: RoomVisualizationData;

    private _roomPlaneParser: RoomPlaneParser;
    private _roomPlaneBitmapMaskParser: RoomPlaneBitmapMaskParser;

    private _geometryUpdateId: number;
    private _boundingRectangle: Rectangle;
    private _directionX: number;
    private _directionY: number;
    private _directionZ: number;
    private _floorThickness: number;
    private _wallThickness: number;
    private _holeUpdateTime: number;
    private _planes: RoomPlane[];
    private _visiblePlanes: RoomPlane[];
    private _visiblePlaneSpriteNumbers: number[];
    private _roomScale: number;
    private _lastUpdateTime: number;
    private _updateIntervalTime: number;
    private _wallType: string;
    private _floorType: string;
    private _landscapeType: string;
    private _colorBackgroundOnly: boolean;
    private _color: number;
    private _redColor: number;
    private _greenColor: number;
    private _blueColor: number;
    private _typeVisibility: boolean[];
    private _assetUpdateCounter: number;
    private _maskData: RoomMapMaskData;
    private _isPlaneSet: boolean;

    constructor()
    {
        super();

        this._data = null;

        this._roomPlaneParser = new RoomPlaneParser();
        this._roomPlaneBitmapMaskParser = new RoomPlaneBitmapMaskParser();

        this._geometryUpdateId = -1;
        this._directionX = 0;
        this._directionY = 0;
        this._directionZ = 0;
        this._floorThickness = 1;
        this._wallThickness = 1;
        this._holeUpdateTime = NaN;
        this._planes = [];
        this._visiblePlanes = [];
        this._visiblePlaneSpriteNumbers = [];
        this._roomScale = 0;
        this._lastUpdateTime = -1000;
        this._updateIntervalTime = 250;
        this._wallType = null;
        this._floorType = null;
        this._landscapeType = null;
        this._colorBackgroundOnly = true;
        this._color = 0xFFFFFF;
        this._redColor = 0xFF;
        this._greenColor = 0xFF;
        this._blueColor = 0xFF;
        this._typeVisibility = [];
        this._assetUpdateCounter = 0;
        this._maskData = null;
        this._isPlaneSet = false;

        this._typeVisibility[RoomPlane.TYPE_UNDEFINED] = false;
        this._typeVisibility[RoomPlane.TYPE_FLOOR] = true;
        this._typeVisibility[RoomPlane.TYPE_WALL] = true;
        this._typeVisibility[RoomPlane.TYPE_LANDSCAPE] = true;
    }

    public static getTextureCache(key: any): RenderTexture
    {
        const existing = RoomVisualization.RENDER_TEXTURE_CACHE.get(RoomVisualization.LAST_VISUALIZATION);

        if(!existing) return null;

        return existing.getValue(key);
    }

    public static addTextureCache(key: any, value: RenderTexture): void
    {
        if(!RoomVisualization.LAST_VISUALIZATION) return;

        let existing = RoomVisualization.RENDER_TEXTURE_CACHE.get(RoomVisualization.LAST_VISUALIZATION);

        if(!existing)
        {
            existing = new AdvancedMap();

            RoomVisualization.RENDER_TEXTURE_CACHE.set(RoomVisualization.LAST_VISUALIZATION, existing);
        }

        existing.add(key, value);
    }

    public initialize(data: IObjectVisualizationData): boolean
    {
        if(!(data instanceof RoomVisualizationData)) return false;

        this._data = data;

        super.initialize(data);

        this._data.setGraphicAssetCollection(this.asset);

        return true;
    }

    public dispose(): void
    {
        super.dispose();

        this.clearPlanes();

        this._planes = null;
        this._visiblePlanes = null;
        this._visiblePlaneSpriteNumbers = null;

        if(this._roomPlaneParser)
        {
            this._roomPlaneParser.dispose();

            this._roomPlaneParser = null;
        }

        if(this._roomPlaneBitmapMaskParser)
        {
            this._roomPlaneBitmapMaskParser.dispose();

            this._roomPlaneBitmapMaskParser = null;
        }

        if(this._data)
        {
            this._data.clearCache();

            this._data = null;
        }

        const existingTextureCache = RoomVisualization.RENDER_TEXTURE_CACHE.get(this);

        if(existingTextureCache)
        {
            for(const texture of existingTextureCache.getValues())
            {
                texture.destroy(true);
            }

            existingTextureCache.dispose();

            RoomVisualization.RENDER_TEXTURE_CACHE.delete(this);
        }
    }

    protected reset(): void
    {
        super.reset();

        this._floorType = null;
        this._wallType = null;
        this._landscapeType = null;
        this._maskData = null;
        this._geometryUpdateId = -1;
        this._roomScale = 0;
    }

    public update(geometry: IRoomGeometry, time: number, update: boolean, skipUpdate: boolean): void
    {
        if(!this.object || !geometry) return;

        RoomVisualization.LAST_VISUALIZATION = this;

        let removeCount = 0;

        const existing = RoomVisualization.RENDER_TEXTURE_CACHE.get(RoomVisualization.LAST_VISUALIZATION);

        if(existing) removeCount = existing.length;

        const geometryUpdate = this.updateGeometry(geometry);
        const objectModel = this.object.model;

        let needsUpdate = false;

        if(this.updateThickness(objectModel)) needsUpdate = true;

        if(this.updateHole(objectModel)) needsUpdate = true;

        if(this.initializeRoomPlanes())
        {
            if(existing && removeCount)
            {
                setTimeout(() =>
                {
                    while(removeCount)
                    {
                        const texture = existing.getWithIndex(0);

                        if(texture)
                        {
                            texture.destroy(true);

                            existing.remove(existing.getKey(0));
                        }

                        removeCount--;
                    }
                }, 0);
            }
        }

        needsUpdate = this.updateMasks(objectModel);

        if(((time < (this._lastUpdateTime + this._updateIntervalTime)) && (!geometryUpdate)) && (!needsUpdate)) return;

        if(this.updatePlaneTexturesAndVisibilities(objectModel)) needsUpdate = true;

        if(this.updatePlanes(geometry, geometryUpdate, time)) needsUpdate = true;

        if(needsUpdate)
        {
            let index = 0;

            while(index < this._visiblePlanes.length)
            {
                const spriteIndex = this._visiblePlaneSpriteNumbers[index];
                const sprite = this.getSprite(spriteIndex);
                const plane = this._visiblePlanes[index];

                if(sprite && plane && (plane.type !== RoomPlane.TYPE_LANDSCAPE))
                {
                    if(this._colorBackgroundOnly)
                    {
                        let _local_14 = plane.color;

                        const _local_15 = (((_local_14 & 0xFF) * this._redColor) / 0xFF);
                        const _local_16 = ((((_local_14 >> 8) & 0xFF) * this._greenColor) / 0xFF);
                        const _local_17 = ((((_local_14 >> 16) & 0xFF) * this._blueColor) / 0xFF);
                        const _local_18 = (_local_14 >> 24);

                        _local_14 = ((((_local_18 << 24) + (_local_17 << 16)) + (_local_16 << 8)) + _local_15);

                        sprite.color = _local_14;
                    }
                    else
                    {
                        sprite.color = plane.color;
                    }
                }

                index++;
            }

            this.updateSpriteCounter++;
        }

        this.updateModelCounter = objectModel.updateCounter;
        this._lastUpdateTime = time;
    }

    private updateGeometry(k: IRoomGeometry): boolean
    {
        if(!k) return false;

        if(this._geometryUpdateId === k.updateId) return false;

        this._geometryUpdateId = k.updateId;
        this._boundingRectangle = null;

        const direction = k.direction;

        if(direction && ((direction.x !== this._directionX) || (direction.y !== this._directionY) || (direction.z !== this._directionZ) || (k.scale !== this._roomScale)))
        {
            this._directionX = direction.x;
            this._directionY = direction.y;
            this._directionZ = direction.z;
            this._roomScale = k.scale;

            return true;
        }

        return false;
    }

    private updateThickness(k: IRoomObjectModel): boolean
    {
        if(this.updateModelCounter === k.updateCounter) return false;

        const floorThickness = k.getValue<number>(RoomObjectVariable.ROOM_FLOOR_THICKNESS);
        const wallThickness = k.getValue<number>(RoomObjectVariable.ROOM_WALL_THICKNESS);

        if((!isNaN(floorThickness) && !isNaN(wallThickness)) && ((floorThickness !== this._floorThickness) || (wallThickness !== this._wallThickness)))
        {
            this._floorThickness = floorThickness;
            this._wallThickness = wallThickness;

            this.clearPlanes();

            return true;
        }

        return false;
    }

    private updateHole(k: IRoomObjectModel): boolean
    {
        if(this.updateModelCounter === k.updateCounter) return false;

        const holeUpdate = k.getValue<number>(RoomObjectVariable.ROOM_FLOOR_HOLE_UPDATE_TIME);

        if(!isNaN(holeUpdate) && (holeUpdate !== this._holeUpdateTime))
        {
            this._holeUpdateTime = holeUpdate;

            this.clearPlanes();

            return true;
        }

        return false;
    }

    private updateMasks(k: IRoomObjectModel): boolean
    {
        if(this.updateModelCounter === k.updateCounter) return false;

        let didUpdate = false;

        const planeMask = k.getValue<RoomMapMaskData>(RoomObjectVariable.ROOM_PLANE_MASK_XML);

        if(planeMask !== this._maskData)
        {
            this.updatePlaneMasks(planeMask);

            this._maskData = planeMask;

            didUpdate = true;
        }

        const backgroundColor = k.getValue<number>(RoomObjectVariable.ROOM_BACKGROUND_COLOR);

        if(backgroundColor !== this._color)
        {
            this._color = backgroundColor;
            this._redColor = (this._color & 0xFF);
            this._greenColor = ((this._color >> 8) & 0xFF);
            this._blueColor = ((this._color >> 16) & 0xFF);

            didUpdate = true;
        }

        const backgroundOnly = (k.getValue<boolean>(RoomObjectVariable.ROOM_COLORIZE_BG_ONLY) || false);

        if(backgroundOnly !== this._colorBackgroundOnly)
        {
            this._colorBackgroundOnly = backgroundOnly;

            didUpdate = true;
        }

        return didUpdate;
    }

    private updatePlaneTexturesAndVisibilities(model: IRoomObjectModel): boolean
    {
        if(this.updateModelCounter === model.updateCounter) return false;

        const floorType = model.getValue<string>(RoomObjectVariable.ROOM_FLOOR_TYPE);
        const wallType = model.getValue<string>(RoomObjectVariable.ROOM_WALL_TYPE);
        const landscapeType = model.getValue<string>(RoomObjectVariable.ROOM_LANDSCAPE_TYPE);

        this.updatePlaneTypes(floorType, wallType, landscapeType);

        const floorVisibility = (model.getValue<number>(RoomObjectVariable.ROOM_FLOOR_VISIBILITY) === 1);
        const wallVisibility = (model.getValue<number>(RoomObjectVariable.ROOM_WALL_VISIBILITY) === 1);
        const landscapeVisibility = (model.getValue<number>(RoomObjectVariable.ROOM_LANDSCAPE_VISIBILITY) === 1);

        this.updatePlaneVisibility(floorVisibility, wallVisibility, landscapeVisibility);

        return true;
    }

    private clearPlanes(): void
    {
        if(this._planes)
        {
            while(this._planes.length)
            {
                const plane = this._planes[0];

                if(plane) plane.dispose();

                this._planes.pop();
            }

            this._planes = [];
            this._planes = [];
        }

        this._isPlaneSet = false;
        this._assetUpdateCounter = (this._assetUpdateCounter + 1);

        this.reset();
    }

    protected initializeRoomPlanes(): boolean
    {
        if(!this.object || this._isPlaneSet) return false;

        if(!isNaN(this._floorThickness)) this._roomPlaneParser.floorThicknessMultiplier = this._floorThickness;
        if(!isNaN(this._wallThickness)) this._roomPlaneParser.wallThicknessMultiplier = this._wallThickness;

        const mapData = this.object.model.getValue<RoomMapData>(RoomObjectVariable.ROOM_MAP_DATA);

        if(!this._roomPlaneParser.initializeFromMapData(mapData)) return;

        const _local_3 = this.getLandscapeWidth();
        const _local_4 = this.getLandscapeHeight();

        let _local_5 = 0;
        let randomSeed = this.object.model.getValue<number>(RoomObjectVariable.ROOM_RANDOM_SEED);
        let index = 0;

        while(index < this._roomPlaneParser.planeCount)
        {
            const location = this._roomPlaneParser.getPlaneLocation(index);
            const leftSide = this._roomPlaneParser.getPlaneLeftSide(index);
            const rightSide = this._roomPlaneParser.getPlaneRightSide(index);
            const secondaryNormals = this._roomPlaneParser.getPlaneSecondaryNormals(index);
            const planeType = this._roomPlaneParser.getPlaneType(index);

            let plane: RoomPlane = null;

            if(location && leftSide && rightSide)
            {
                const _local_14 = Vector3d.crossProduct(leftSide, rightSide);

                randomSeed = ((randomSeed * 7613) + 517);
                plane = null;

                if(planeType === RoomPlaneData.PLANE_FLOOR)
                {
                    const _local_15 = ((location.x + leftSide.x) + 0.5);
                    const _local_16 = ((location.y + rightSide.y) + 0.5);
                    const textureOffsetX = (Math.trunc(_local_15) - _local_15);
                    const textureOffsetY = (Math.trunc(_local_16) - _local_16);

                    plane = new RoomPlane(this.object.getLocation(), location, leftSide, rightSide, RoomPlane.TYPE_FLOOR, true, secondaryNormals, randomSeed, -(textureOffsetX), -(textureOffsetY));

                    if(_local_14.z !== 0)
                    {
                        plane.color = RoomVisualization.FLOOR_COLOR;
                    }
                    else
                    {
                        plane.color = ((_local_14.x !== 0) ? RoomVisualization.FLOOR_COLOR_RIGHT : RoomVisualization.FLOOR_COLOR_LEFT);
                    }

                    if(this._data) plane.rasterizer = this._data.floorRasterizer;
                }

                else if(planeType === RoomPlaneData.PLANE_WALL)
                {
                    plane = new RoomPlane(this.object.getLocation(), location, leftSide, rightSide, RoomPlane.TYPE_WALL, true, secondaryNormals, randomSeed);

                    if((leftSide.length < 1) || (rightSide.length < 1))
                    {
                        plane.hasTexture = false;
                    }

                    if((_local_14.x === 0) && (_local_14.y === 0))
                    {
                        plane.color = RoomVisualization.WALL_COLOR_BORDER;
                    }
                    else
                    {
                        if(_local_14.y > 0)
                        {
                            plane.color = RoomVisualization.WALL_COLOR_TOP;
                        }
                        else
                        {
                            if(_local_14.y === 0)
                            {
                                plane.color = RoomVisualization.WALL_COLOR_SIDE;
                            }
                            else
                            {
                                plane.color = RoomVisualization.WALL_COLOR_BOTTOM;
                            }
                        }
                    }

                    if(this._data) plane.rasterizer = this._data.wallRasterizer;
                }

                else if(planeType === RoomPlaneData.PLANE_LANDSCAPE)
                {
                    plane = new RoomPlane(this.object.getLocation(), location, leftSide, rightSide, RoomPlane.TYPE_LANDSCAPE, true, secondaryNormals, randomSeed, _local_5, 0, _local_3, _local_4);

                    if(_local_14.y > 0)
                    {
                        plane.color = RoomVisualization.LANDSCAPE_COLOR_TOP;
                    }
                    else
                    {
                        if(_local_14.y == 0)
                        {
                            plane.color = RoomVisualization.LANDSCAPE_COLOR_SIDE;
                        }
                        else
                        {
                            plane.color = RoomVisualization.LANDSCAPE_COLOR_BOTTOM;
                        }
                    }

                    if(this._data) plane.rasterizer = this._data.landscapeRasterizer;

                    _local_5 = (_local_5 + leftSide.length);
                }

                else if(planeType == RoomPlaneData.PLANE_BILLBOARD)
                {
                    plane = new RoomPlane(this.object.getLocation(), location, leftSide, rightSide, RoomPlane.TYPE_WALL, true, secondaryNormals, randomSeed);
                    if(((leftSide.length < 1) || (rightSide.length < 1)))
                    {
                        plane.hasTexture = false;
                    }
                    if(((_local_14.x == 0) && (_local_14.y == 0)))
                    {
                        plane.color = RoomVisualization.WALL_COLOR_BORDER;
                    }
                    else
                    {
                        if(_local_14.y > 0)
                        {
                            plane.color = RoomVisualization.WALL_COLOR_TOP;
                        }
                        else
                        {
                            if(_local_14.y == 0)
                            {
                                plane.color = RoomVisualization.WALL_COLOR_SIDE;
                            }
                            else
                            {
                                plane.color = RoomVisualization.WALL_COLOR_BOTTOM;
                            }
                        }
                    }
                    // if (this._Str_594 != null)
                    // {
                    //     _local_13.rasterizer = this._Str_594._Str_23913;
                    // }
                }


                if(plane)
                {
                    plane.maskManager = this._data.maskManager;

                    let _local_19 = 0;

                    while(_local_19 < this._roomPlaneParser.getPlaneMaskCount(index))
                    {
                        const _local_20 = this._roomPlaneParser.getPlaneMaskLeftSideLoc(index, _local_19);
                        const _local_21 = this._roomPlaneParser.getPlaneMaskRightSideLoc(index, _local_19);
                        const _local_22 = this._roomPlaneParser.getPlaneMaskLeftSideLength(index, _local_19);
                        const _local_23 = this._roomPlaneParser.getPlaneMaskRightSideLength(index, _local_19);

                        plane.addRectangleMask(_local_20, _local_21, _local_22, _local_23);

                        _local_19++;
                    }

                    this._planes.push(plane);
                }
            }
            else
            {
                return;
            }

            index++;
        }

        this._isPlaneSet = true;
        this.defineSprites();

        return true;
    }

    protected defineSprites(): void
    {
        this.createSprites(this._planes.length);

        let planeIndex = 0;

        while(planeIndex < this._planes.length)
        {
            const plane = this._planes[planeIndex];
            const sprite = this.getSprite(planeIndex);

            if(plane && sprite && plane.leftSide && plane.rightSide)
            {
                if((plane.type === RoomPlane.TYPE_WALL) && ((plane.leftSide.length < 1) || (plane.rightSide.length < 1)))
                {
                    sprite.alphaTolerance = AlphaTolerance.MATCH_NOTHING;
                }
                else
                {
                    sprite.alphaTolerance = AlphaTolerance.MATCH_OPAQUE_PIXELS;
                }

                if(plane.type === RoomPlane.TYPE_WALL)
                {
                    sprite.tag = 'plane.wall@' + (planeIndex + 1);
                }

                else if(plane.type === RoomPlane.TYPE_FLOOR)
                {
                    sprite.tag = 'plane.floor@' + (planeIndex + 1);
                }

                else
                {
                    sprite.tag = 'plane@' + (planeIndex + 1);
                }

                sprite.spriteType = RoomObjectSpriteType.ROOM_PLANE;
            }

            planeIndex++;
        }
    }

    private getLandscapeWidth(): number
    {
        let length = 0;
        let index = 0;

        while(index < this._roomPlaneParser.planeCount)
        {
            const type = this._roomPlaneParser.getPlaneType(index);

            if(type === RoomPlaneData.PLANE_LANDSCAPE)
            {
                const vector = this._roomPlaneParser.getPlaneLeftSide(index);

                length += vector.length;
            }

            index++;
        }

        return length;
    }

    private getLandscapeHeight(): number
    {
        let length = 0;
        let index = 0;

        while(index < this._roomPlaneParser.planeCount)
        {
            const type = this._roomPlaneParser.getPlaneType(index);

            if(type === RoomPlaneData.PLANE_LANDSCAPE)
            {
                const vector = this._roomPlaneParser.getPlaneRightSide(index);

                if(vector.length > length) length = vector.length;
            }

            index++;
        }

        if(length > 5) length = 5;

        return length;
    }

    protected updatePlaneTypes(floorType: string, wallType: string, landscapeType: string): boolean
    {
        if(floorType !== this._floorType) this._floorType = floorType;
        else floorType = null;

        if(wallType !== this._wallType) this._wallType = wallType;
        else wallType = null;

        if(landscapeType !== this._landscapeType) this._landscapeType = landscapeType;
        else landscapeType = null;

        if(!floorType && !wallType && !landscapeType) return false;

        let index = 0;

        while(index < this._planes.length)
        {
            const plane = this._planes[index];

            if(plane)
            {
                if((plane.type === RoomPlane.TYPE_FLOOR) && floorType)
                {
                    plane.id = floorType;
                }

                else if((plane.type === RoomPlane.TYPE_WALL) && wallType)
                {
                    plane.id = wallType;
                }

                else if((plane.type === RoomPlane.TYPE_LANDSCAPE) && landscapeType)
                {
                    plane.id = landscapeType;
                }
            }

            index++;
        }

        return true;
    }

    private updatePlaneVisibility(k: boolean, _arg_2: boolean, _arg_3: boolean): void
    {
        if((k === this._typeVisibility[RoomPlane.TYPE_FLOOR]) && (_arg_2 === this._typeVisibility[RoomPlane.TYPE_WALL]) && (_arg_3 === this._typeVisibility[RoomPlane.TYPE_LANDSCAPE])) return;

        this._typeVisibility[RoomPlane.TYPE_FLOOR] = k;
        this._typeVisibility[RoomPlane.TYPE_WALL] = _arg_2;
        this._typeVisibility[RoomPlane.TYPE_LANDSCAPE] = _arg_3;

        this._visiblePlanes = [];
        this._visiblePlaneSpriteNumbers = [];
    }

    protected updatePlanes(k: IRoomGeometry, _arg_2: boolean, _arg_3: number): boolean
    {
        if(!k || !this.object) return;

        this._assetUpdateCounter++;

        if(_arg_2)
        {
            this._visiblePlanes = [];
            this._visiblePlaneSpriteNumbers = [];
        }

        const _local_8 = (this._visiblePlanes.length > 0);

        let _local_6 = this._visiblePlanes;

        if(!this._visiblePlanes.length) _local_6 = this._planes;

        let depth = 0;
        let updated = false;
        let index = 0;

        while(index < _local_6.length)
        {
            let _local_10 = index;

            if(_local_8) _local_10 = this._visiblePlaneSpriteNumbers[index];

            const _local_11 = this.getSprite(_local_10);

            if(_local_11)
            {
                const _local_12 = _local_6[index];

                if(_local_12)
                {
                    _local_11.id = _local_12.uniqueId;

                    if(_local_12.update(k, _arg_3))
                    {
                        if(_local_12.visible)
                        {
                            depth = ((_local_12.relativeDepth + this.floorRelativeDepth) + (_local_10 / 1000));

                            if(_local_12.type !== RoomPlane.TYPE_FLOOR)
                            {
                                depth = ((_local_12.relativeDepth + this.wallRelativeDepth) + (_local_10 / 1000));

                                if((_local_12.leftSide.length < 1) || (_local_12.rightSide.length < 1))
                                {
                                    depth = (depth + (RoomVisualization.ROOM_DEPTH_OFFSET * 0.5));
                                }
                            }

                            const _local_14 = ((('plane ' + _local_10) + ' ') + k.scale);

                            this.updateSprite(_local_11, _local_12, _local_14, depth);
                        }
                        updated = true;
                    }
                    if(_local_11.visible != ((_local_12.visible) && (this._typeVisibility[_local_12.type])))
                    {
                        _local_11.visible = (!(_local_11.visible));
                        updated = true;
                    }
                    if(_local_11.visible)
                    {
                        if(!_local_8)
                        {
                            this._visiblePlanes.push(_local_12);
                            this._visiblePlaneSpriteNumbers.push(index);
                        }
                    }
                }
                else
                {
                    _local_11.id = 0;
                    if(_local_11.visible)
                    {
                        _local_11.visible = false;
                        updated = true;
                    }
                }
            }
            index++;
        }

        return updated;
    }

    protected updatePlaneMasks(k: RoomMapMaskData): void
    {
        if(!k) return;

        this._roomPlaneBitmapMaskParser.initialize(k);

        const _local_4: number[] = [];
        const _local_5: number[] = [];

        let _local_6 = false;
        let index = 0;

        while(index < this._planes.length)
        {
            const plane = this._planes[index];

            if(plane)
            {
                plane.resetBitmapMasks();

                if(plane.type === RoomPlane.TYPE_LANDSCAPE) _local_4.push(index);
            }

            index++;
        }

        for(const mask of this._roomPlaneBitmapMaskParser.masks.values())
        {
            const maskType = this._roomPlaneBitmapMaskParser.getMaskType(mask);
            const maskLocation = this._roomPlaneBitmapMaskParser.getMaskLocation(mask);
            const maskCategory = this._roomPlaneBitmapMaskParser.getMaskCategory(mask);

            if(maskLocation)
            {
                let i = 0;

                while(i < this._planes.length)
                {
                    const plane = this._planes[i];

                    if((plane.type === RoomPlane.TYPE_WALL) || (plane.type === RoomPlane.TYPE_LANDSCAPE))
                    {
                        if(plane && plane.location && plane.normal)
                        {
                            const _local_14 = Vector3d.dif(maskLocation, plane.location);
                            const _local_15 = Math.abs(Vector3d.scalarProjection(_local_14, plane.normal));

                            if(_local_15 < 0.01)
                            {
                                if(plane.leftSide && plane.rightSide)
                                {
                                    const _local_16 = Vector3d.scalarProjection(_local_14, plane.leftSide);
                                    const _local_17 = Vector3d.scalarProjection(_local_14, plane.rightSide);

                                    if((plane.type === RoomPlane.TYPE_WALL) || ((plane.type === RoomPlane.TYPE_LANDSCAPE) && (maskCategory === RoomPlaneBitmapMaskData.HOLE)))
                                    {
                                        plane.addBitmapMask(maskType, _local_16, _local_17);
                                    }
                                    else
                                    {
                                        if(plane.type === RoomPlane.TYPE_LANDSCAPE)
                                        {
                                            if(!plane.canBeVisible) _local_6 = true;

                                            plane.canBeVisible = true;

                                            _local_5.push(i);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    i++;
                }
            }
        }

        index = 0;

        while(index < _local_4.length)
        {
            const planeIndex = _local_4[index];

            if(_local_5.indexOf(planeIndex) < 0)
            {
                const plane = this._planes[planeIndex];

                plane.canBeVisible = false;
                _local_6 = true;
            }

            index++;
        }

        if(_local_6)
        {
            this._visiblePlanes = [];
            this._visiblePlaneSpriteNumbers = [];
        }
    }

    private updateSprite(k: IRoomObjectSprite, _arg_2: RoomPlane, _arg_3: string, _arg_4: number): void
    {
        const offset = _arg_2.offset;

        k.offsetX = -(offset.x);
        k.offsetY = -(offset.y);
        k.relativeDepth = _arg_4;
        k.color = _arg_2.color;
        k.texture = this.getPlaneBitmap(_arg_2, _arg_3);
        k.name = ((_arg_3 + '_') + this._assetUpdateCounter);
    }

    private getPlaneBitmap(k: RoomPlane, _arg_2: string): Texture<Resource>
    {
        return k.bitmapData;
    }

    public getBoundingRectangle(): Rectangle
    {
        if(!this._boundingRectangle) this._boundingRectangle = super.getBoundingRectangle();

        return new Rectangle(this._boundingRectangle.x, this._boundingRectangle.y, this._boundingRectangle.width, this._boundingRectangle.height);
    }

    public get planes(): IRoomPlane[]
    {
        const planes: IRoomPlane[] = [];

        for(const plane of this._visiblePlanes) planes.push(plane);

        return planes;
    }

    public get floorRelativeDepth(): number
    {
        return RoomVisualization.ROOM_DEPTH_OFFSET + 0.1;
    }

    public get wallRelativeDepth(): number
    {
        return RoomVisualization.ROOM_DEPTH_OFFSET + 0.5;
    }
}