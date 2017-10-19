/**
 * Loads a Microsoft .xaml file
 *
 * @author Nicolas Daures
 */

THREE.XAMLLoader = function(manager)
{
    this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
};

THREE.XAMLLoader.prototype =
{
    /************************************************************************************
     * Constructor
     ************************************************************************************/

    /**
     * Create Xaml loader.
     */
    constructor: THREE.XAMLLoader,


    /************************************************************************************
     * Operations
     ************************************************************************************/

    /**
     * Load Xaml file.
     * @param url: url of the Xaml file
     * @param onLoad: onload callback
     * @param onProgress: onprogress callback
     * @param onError: onerror callback
     */
    load: function ( url, onLoad, onProgress, onError )
    {
        var self = this;

        var loader = new THREE.FileLoader(self.manager);
        loader.setResponseType('text');
        loader.load(url, function(text)
        {
            var baseUrl = url.substring(0, url.lastIndexOf('/')+1);
            self.parse(text, baseUrl, onLoad);
        }, onProgress, onError);
    },

    /**
     * Parse given Xaml data.
     * @param data: data to parse
     * @param baseUrl: base url of Xaml file
     */
    parse: function(data, baseUrl, onLoad)
    {
        // Create the root
        this.group = new THREE.Group();

        this.materialParams = [];
        this.vertices = [];
        this.normals = [];
        this.uvs = [];
        this.indices = [];
        this.groups = [];

        // Parse XML
        var parser;
        if (window.DOMParser)
        {
            parser = new DOMParser();
            this.xmlDoc = parser.parseFromString(data, "text/xml");
        }
        else // Internet Explorer
        {
            this.xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            this.xmlDoc.async = false;
            this.xmlDoc.loadXML(data);
        }

        // Search camera node
        this.cameraMatrix = null;
        var nodeCamera = this.xmlDoc.getElementsByTagName("PerspectiveCamera.Transform")[0];
        if (nodeCamera)
        {
            var nodeCameraMatrix = this._getChildNodeByName(nodeCamera, "MatrixTransform3D");
            if (nodeCameraMatrix)
            {
                var attrCamera = this._getAttributeByName(nodeCameraMatrix, "Matrix");
                if (attrCamera)
                {
                    var strCameraMatrix = attrCamera.value;
                    var strCameraMatrixTokens = strCameraMatrix.split(/[ ,]+/);
                    var matrixArray = [];
                    for (var i = 0; i < strCameraMatrixTokens.length; i++)
                    {
                        matrixArray.push(parseFloat(strCameraMatrixTokens[i]));
                    }
                    if (matrixArray.length == 16)
                    {
                        this.cameraMatrix = new THREE.Matrix4();
                        this.cameraMatrix.set(matrixArray[0], matrixArray[1], matrixArray[2], matrixArray[3],
                            matrixArray[4], matrixArray[5], matrixArray[6], matrixArray[7],
                            matrixArray[8], matrixArray[9], matrixArray[10], matrixArray[11],
                            matrixArray[12], matrixArray[13], matrixArray[14], matrixArray[15]);
                    }
                }
            }
        }

        // Create a callback to texture loading
        var self = this;
        this.onTextureLoaded = function()
        {
            self.loading--;
            if (self.loading == 0)
            {
                self.createMeshes(onLoad);
            }
        }

        // Search 3D group and parse it
        this.modelIndex = 0;
        this.loading = 0;

        var rootElement = this.xmlDoc.getElementsByTagName("Viewport3D.Children");
        if (rootElement == null || !rootElement.length)
        {
            rootElement = this.xmlDoc.getElementsByTagName("ModelVisual3D");
        }
        if (rootElement != null && rootElement.length)
        {
            rootElement = rootElement[0];

            var groups = [];
            if(rootElement.childNodes != null) {
                for (var contentIndex = 0; contentIndex < rootElement.childNodes.length; contentIndex++)
                {
                    var childNode = rootElement.childNodes[contentIndex];
                    if (childNode.nodeName == "Model3DGroup" ||
                        childNode.nodeName == "ModelVisual3D" ||
                        childNode.nodeName == "ModelVisual3D.Content")
                    {
                        groups.push(childNode);
                    }
                }
            }

            var groupCount = groups.length;
            var groupIndex;
            for (groupIndex = 0; groupIndex < groupCount; groupIndex++)
            {
                var node = groups[groupIndex];
                this._parseNode(node, baseUrl, this.group);
            }
        }

        var cameraNode = this.xmlDoc.getElementsByTagName("PerspectiveCamera")[0];
        if (cameraNode)
        {
            this._parseCamera(cameraNode);
        }

        if (this.loading == 0)
        {
            this.createMeshes(onLoad);
        }
    },

    /**
     * Create all meshes parsed in xaml file.
     */
    createMeshes: function (onLoad)
    {
        for (var index = 0; index < this.vertices.length; index++)
        {
            // Create the mesh with geometry and material
            var geometry = new THREE.Geometry();
            var materialParams = this.materialParams[index];
            var material = new THREE.MeshPhongMaterial(materialParams);
            var mesh = new THREE.Mesh(geometry, material);

            if (this.vertices[index].length > 0)
            {
                var vertices = this.vertices[index];
                var normals = this.normals[index];
                var uvs = this.uvs[index];
                var indices = this.indices[index];

                geometry.vertices = vertices;

                // Add faces and normals
                for (var i = 0; i < indices.length; i += 3)
                {
                    // Get indices
                    var indice1 = indices[i];
                    var indice2 = indices[i+1];
                    var indice3 = indices[i+2];

                    // Compute normal if needed
                    var normal1 = normals[indice1];
                    var normal2 = normals[indice2];
                    var normal3 = normals[indice3];
                    var normal = new THREE.Vector3(1, 0, 0);
                    if (normal1 == null || normal2 == null || normal3 == null)
                    {
                        var vertex1 = vertices[indice1];
                        var vertex2 = vertices[indice2];
                        var vertex3 = vertices[indice3];
                        normal.x = vertex1.x + vertex2.x + vertex3.x;
                        normal.y = vertex1.y + vertex2.y + vertex3.y;
                        normal.z = vertex1.z + vertex2.z + vertex3.z;
                        var normalLenght = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
                        normal.x /= normalLenght;
                        normal.y /= normalLenght;
                        normal.z /= normalLenght;

                        if (normal1 == null)
                        {
                            normal1 = normal;
                        }
                        if (normal2 == null)
                        {
                            normal2 = normal;
                        }
                        if (normal3 == null)
                        {
                            normal3 = normal;
                        }
                    }

                    geometry.faces.push(new THREE.Face3(indices[i], indices[i + 1], indices[i + 2],
                        [
                            normal1,
                            normal2,
                            normal3
                        ]
                    ));
                }

                /* TODO
                 var faceUV = [];
                 for ( var i = 0; i < geometry.faces.length; i ++ )
                 {
                 var uv1 = uvs[ geometry.faces[ i ].a ];
                 var uv2 = uvs[ geometry.faces[ i ].b ];
                 var uv3 = uvs[ geometry.faces[ i ].c ];

                 if (uv1 == null) uv1 = new THREE.Vector2(0, 0);
                 if (uv2 == null) uv2 = new THREE.Vector2(0, 0);
                 if (uv3 == null) uv3 = new THREE.Vector2(0, 0);
                 faceUV.push( uv1, uv2, uv3);
                 }
                 geometry.faceVertexUvs[0] = faceUV;*/
                geometry.computeVertexNormals();

                // Add the new mesh to group
                this.groups[index].add(mesh);
            }
        }

        onLoad(this.group, this.cameraMatrix, this.camera);
    },


    /************************************************************************************
     * Private Operations
     ************************************************************************************/

    /**
     * Recursive parse node
     * @param node: content of .xaml file
     * @param baseUrl: base of url (which contains textures)
     * @param group: current 3D group
     */
    _parseNode: function (node, baseUrl, group)
    {
        // Parse children
        for (var childIndex = 0; childIndex < node.childNodes.length; childIndex++)
        {
            var subNode = node.childNodes[childIndex];

            // Children
            if (subNode.nodeName == "Model3DGroup.Children" || subNode.nodeName == "ModelVisual3D.Content")
            {
                this._parseNode(subNode, baseUrl, group);
            }

            // Sub-group
            else if (subNode.nodeName == "Model3DGroup")
            {
                // Create a sub-group
                var subGroup = new THREE.Group();
                group.add(subGroup);

                this._parseNode(subNode, baseUrl, subGroup);
            }

            // Transformation
            else if (subNode.nodeName == "Model3DGroup.Transform")
            {
                this._parseTransformation(subNode, group);
            }

            // Mesh
            else if (subNode.nodeName == "GeometryModel3D")
            {
                this._parseMesh(subNode, baseUrl, group);
            }

            // Light
            else if (   subNode.nodeName == "SpotLight"
                ||      subNode.nodeName == "DirectionalLight"
                ||      subNode.nodeName == "PointLight")
            {
                this._parseLight(subNode, group);
            }
        }
    },

    /**
     * Parse mesh
     * @param node: content of .xaml file
     * @param group: current 3D group
     */
    _parseTransformation: function(node, group)
    {
        // Parse transformation
        var matrixTransfo = this._getChildNodeByName(node, "MatrixTransform3D");
        if (matrixTransfo)
        {
            var attrMatrix = this._getAttributeByName(matrixTransfo, "Matrix");
            if (attrMatrix)
            {
                var strTransformation = attrMatrix.value;
                var transfoResult = strTransformation.split(/[ ,]+/);
                var transfo = [];
                for (var i = 0; i < transfoResult.length; i++)
                {
                    transfo.push(parseFloat(transfoResult[i]));
                }
                if (transfo.length == 16)
                {
                    /* Tait-Bryan angles
                     * -----------------
                     * XYZ = | cy*cz,               cy*sz,              sy,         0 |
                     *       | cx*sz + cz*sx*sy,    cx*cz - sx*sy*sz,   -cy*sx,     0 |
                     *       | sx*sz - cx*cz*sy,    cz*sx + cx*sy*sz,   cx*cy,      0 |
                     *       | 0,                   0,                  0,          1 |
                     *
                     * => sy = XYZ[2]
                     * => tz = XYZ[1] / XYZ[0] = cy*sz / cy*cz = sz / cz
                     * => tx = -XYZ[6] / XYZ[10] = cy*sx / cy*cx = sx / cx
                     */
                    var matrix4 = new THREE.Matrix4();
                    matrix4.set(transfo[0], transfo[1], transfo[2], transfo[3],
                        transfo[4], transfo[5], transfo[6], transfo[7],
                        transfo[8], transfo[9], transfo[10], transfo[11],
                        transfo[12], transfo[13], transfo[14], transfo[15]);

                    // Decompose the matrix
                    var translation = new THREE.Vector3(0, 0, 0);
                    var quaternion = new THREE.Quaternion();
                    var scale = new THREE.Vector3(0, 0, 0);
                    matrix4.decompose(translation, quaternion, scale);

                    // Set position and scale of 3D group
                    group.position.x = transfo[12];
                    group.position.y = transfo[13];
                    group.position.z = transfo[14];
                    group.scale = scale;

                    // Compute rotation and apply it to 3D group
                    var angleX = 0;
                    var angleY = -Math.asin(transfo[2]);
                    var angleZ = 0;
                    var cosY = Math.cos(angleY);

                    if (Math.abs(cosY) > 0.0005)
                    {
                        var tr_x = transfo[10] / cosY;
                        var tr_y = transfo[6] / cosY;
                        angleX = Math.atan2(tr_y, tr_x);

                        tr_x = transfo[0] / cosY;
                        tr_y = transfo[1] / cosY;
                        angleZ = Math.atan2(tr_y, tr_x);
                    }
                    else
                    {
                        angleX = 0;

                        var tr_x = transfo[5];
                        var tr_y = transfo[1];
                        angleZ = Math.atan2(tr_y, tr_x);
                    }

                    group.rotation.x = angleX;
                    group.rotation.y = angleY;
                    group.rotation.z = angleZ;
                }
            }
        }

        // Search rotation node
        var nodesRotation = node.getElementsByTagName("AxisAngleRotation3D");
        for (var nodeIndex = 0; nodeIndex < nodesRotation.length; nodeIndex++)
        {
            var nodeRotation = nodesRotation[nodeIndex];

            var attrAxis = this._getAttributeByName(nodeRotation, "Axis");
            if (attrAxis)
            {
                var strAxis = attrAxis.value;
                var result = strAxis.split(',');
                if (result.length == 3)
                {
                    var axisX = parseFloat(result[0]);
                    var axisY = parseFloat(result[1]);
                    var axisZ = parseFloat(result[2]);
                    if (!isNaN(axisX) && !isNaN(axisY) && !isNaN(axisZ))
                    {
                        var attrAngle = this._getAttributeByName(nodeRotation, "Angle");
                        if (attrAngle)
                        {
                            var angle = parseFloat(attrAngle.value);
                            if (!isNaN(angle))
                            {
                                var matrix = new THREE.Matrix4();
                                matrix.makeRotationAxis(new THREE.Vector3(axisX, axisY, axisZ), angle * Math.PI / 180);

                                var newGroup = new THREE.Group();
                                newGroup.applyMatrix(matrix);
                                group.add(newGroup);
                                group = newGroup;
                            }
                        }
                    }
                }
            }

        }

        // Search scale node
        var nodeScale = this._getChildNodeByName(node, "ScaleTransform3D", true);
        if (nodeScale)
        {
            var attrScaleX = this._getAttributeByName(nodeScale, "ScaleX");
            if (attrScaleX)
            {
                group.scale.x = parseFloat(attrScaleX.value);
            }
            var attrScaleY = this._getAttributeByName(nodeScale, "ScaleY");
            if (attrScaleY)
            {
                group.scale.y = parseFloat(attrScaleY.value);
            }
            var attrScaleZ = this._getAttributeByName(nodeScale, "ScaleZ");
            if (attrScaleZ)
            {
                group.scale.z = parseFloat(attrScaleZ.value);
            }
        }
    },

    /**
     * Parse mesh
     * @param node: content of .xaml file
     * @param baseUrl: base of url (which contains textures)
     * @param group: current 3D group
     */
    _parseMesh: function(node, baseUrl, group)
    {
        var self = this;
        var modelIndex = this.modelIndex;
        this.modelIndex++;

        this.vertices[modelIndex] = [];
        this.normals[modelIndex] = [];
        this.uvs[modelIndex] = [];
        this.indices[modelIndex] = [];
        this.groups[modelIndex] = group;

        // Parse geometry
        var strMaterial = null;
        var strGeometry = this._getChildNodeByName(node, "MeshGeometry3D", true);
        if (strGeometry == null)
        {
            // Search the geometry by key
            var attrGeometry = this._getAttributeByName(node, "Geometry");
            if (attrGeometry)
            {
                var attrValue = attrGeometry.value;
                var keyToken = attrValue.substring(1, attrValue.length-1).split(' ');
                var key = keyToken[1];
                var geometries = this.xmlDoc.getElementsByTagName("MeshGeometry3D");
                for (var geometryIndex = 0; geometryIndex < geometries.length; geometryIndex++)
                {
                    var geo = geometries[geometryIndex];
                    var attrGeo = this._getAttributeByName(geo, "x:Key");
                    if (attrGeo.value == key)
                    {
                        strGeometry = geometries[geometryIndex];
                        break;
                    }
                }
            }

            // Search the material by key
            var attrMaterial = this._getAttributeByName(node, "Material");
            if (attrMaterial)
            {
                var attrValue = attrMaterial.value;
                var keyToken = attrValue.substring(1, attrValue.length-1).split(' ');
                var key = keyToken[1];
                var materials = this.xmlDoc.getElementsByTagName("MaterialGroup");
                for (var materialIndex = 0; materialIndex < materials.length; materialIndex++)
                {
                    var material = materials[materialIndex];
                    var attrMaterial = this._getAttributeByName(material, "x:Key");
                    if (attrMaterial.value == key)
                    {
                        strMaterial = materials[materialIndex];
                        break;
                    }
                }
            }
        }
        else
        {
            // Search the material by key
            var attrMaterial = this._getAttributeByName(node, "Material");
            if (attrMaterial)
            {
                var attrValue = attrMaterial.value;
                var keyToken = attrValue.substring(1, attrValue.length-1).split(' ');
                var key = keyToken[1];
                var materials = this.xmlDoc.getElementsByTagName("MaterialGroup");
                for (var materialIndex = 0; materialIndex < materials.length; materialIndex++)
                {
                    var material = materials[materialIndex];
                    var attrMaterial = this._getAttributeByName(material, "x:Key");
                    if (attrMaterial.value == key)
                    {
                        strMaterial = materials[materialIndex];
                        break;
                    }
                }
            }
        }

        if (strGeometry)
        {
            var attrPositions = this._getAttributeByName(strGeometry, "Positions");
            var attrNormals = this._getAttributeByName(strGeometry, "Normals");
            var attrUVs = this._getAttributeByName(strGeometry, "TextureCoordinates");
            var attrIndices = this._getAttributeByName(strGeometry, "TriangleIndices");
            var separator = /[ ,]+/;

            // Read positions
            if (attrPositions)
            {
                var strPositions = attrPositions.value;
                strPositions = strPositions.trim();
                var result = strPositions.split(separator);
                for (var i = 0; i < result.length; i += 3)
                {
                    var x = parseFloat(result[ i ]);
                    var y = parseFloat(result[ i + 1 ]);
                    var z = parseFloat(result[ i + 2 ]);
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z))
                    {
                        this.vertices[modelIndex].push(new THREE.Vector3(x, y, z));
                    }
                    else
                    {
                        var vertex = new THREE.Vector3(0, 0, 0);
                        if (!isNaN(x))
                        {
                            vertex.x = x;
                        }
                        if (!isNaN(y))
                        {
                            vertex.y = y;
                        }
                        if (!isNaN(z))
                        {
                            vertex.z = z;
                        }
                        this.vertices[modelIndex].push(vertex);
                    }
                }
            }

            // Read normals
            if (attrNormals)
            {
                var strNormals = attrNormals.value;
                strNormals = strNormals.trim();
                result = strNormals.split(separator);
                for (var i = 0; i < result.length; i += 3)
                {
                    var x = parseFloat(result[ i ]);
                    var y = parseFloat(result[ i + 1 ]);
                    var z = parseFloat(result[ i + 2 ]);
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z))
                    {
                        this.normals[modelIndex].push(new THREE.Vector3(x, y, z));
                    }
                    else
                    {
                        var normal = new THREE.Vector3(0, 0, 0);
                        if (!isNaN(x))
                        {
                            normal.x = x;
                        }
                        if (!isNaN(y))
                        {
                            normal.y = y;
                        }
                        if (!isNaN(z))
                        {
                            normal.z = z;
                        }
                        if (normal.x == 0 && normal.y == 0 && normal.z == 0)
                        {
                            normal.x == 1;
                        }
                        var normalLength = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
                        normal.x /= normalLength;
                        normal.y /= normalLength;
                        normal.z /= normalLength;
                        this.normals[modelIndex].push(normal);
                    }
                }
            }

            // Read texture coordinates
            if (attrUVs)
            {
                var strUVs = attrUVs.value;
                strUVs = strUVs.trim();
                result = strUVs.split(separator);
                for (var i = 0; i < result.length; i += 2)
                {
                    var u = parseFloat(result[ i ]);
                    var v = parseFloat(result[ i + 1 ]);
                    if (!isNaN(u) && !isNaN(v))
                    {
                        u = u < 0 ? -u : u;
                        v = v < 0 ? -v : v;                         // Xaml exporter give negative UVs...
                        this.uvs[modelIndex].push(new THREE.Vector2(u, v));
                    }
                    else
                    {
                        this.uvs[modelIndex].push(new THREE.Vector2(0.5, 0.5));

                        var uv = new THREE.Vector2(0, 0);
                        if (!isNaN(u))
                        {
                            uv.x = u;
                        }
                        if (!isNaN(v))
                        {
                            uv.y = v;
                        }
                        this.uvs[modelIndex].push(uv);
                    }
                }
            }

            // Read indices
            if (attrIndices)
            {
                var strIndices = attrIndices.value;
                strIndices = strIndices.trim();
                result = strIndices.split(separator);
                for (var i = 0; i < result.length; i++)
                {
                    var ind = parseInt(result[ i ]);
                    if (!isNaN(ind))
                    {
                        this.indices[modelIndex].push(ind);
                    }
                    else
                    {
                        this.indices[modelIndex].push(1);
                    }
                }
            }

            // Read material
            this.materialParams[modelIndex] = {};
            if (strMaterial == null)
            {
                strMaterial = this._getChildNodeByName(node, "MaterialGroup", true);
            }
            if (strMaterial)
            {
                var strDiffuse = this._getChildNodeByName(strMaterial, "DiffuseMaterial", true);
                var strSpecular = this._getChildNodeByName(strMaterial, "SpecularMaterial", true);

                // Parse diffuse color of diffuse map
                if (strDiffuse)
                {
                    this._parseColor(strDiffuse, modelIndex, baseUrl, true);
                }

                // Parse specular color of specular map
                if (strSpecular)
                {
                    this._parseColor(strSpecular, modelIndex, baseUrl, false);
                }
            }
        }
    },

    /**
     * Parse color.
     * @param node: color node to parse
     * @param index: material index
     * @param baseUrl: base of url (which contains textures)
     * @param isDiffuse: true if diffuse color, else it is secular color
     */
    _parseColor: function(node, index, baseUrl, isDiffuse)
    {
        var color = null;
        var attrBrush = this._getAttributeByName(node, "Brush");
        if (!attrBrush)
        {
            var nodeSolidColorBrush = this._getChildNodeByName(node, "SolidColorBrush", true);
            if (nodeSolidColorBrush)
            {
                attrBrush = this._getAttributeByName(nodeSolidColorBrush, "Color");
            }
        }
        if (attrBrush)
        {
            color = attrBrush.value;

            // Convert hexadecimal value (ex '#AABBCCDD' to '0xAABBCCDD') for material
            if (color[0] == '#')
            {
                if (color.length > 7)
                {
                    color = parseInt("0x" + color.slice(3, color.length));
                }
                else
                {
                    color = parseInt("0x" + color.slice(1, color.length));
                }
            }
            if (isDiffuse)
            {
                this.materialParams[index].color = color;
            }
            else
            {
                this.materialParams[index].specular = color;
            }
        }
        else
        {
            var imageBrush = this._getChildNodeByName(node, "ImageBrush", true);
            if (imageBrush)
            {
                var attrImageSource = this._getAttributeByName(imageBrush, "ImageSource");
                if (attrImageSource)
                {
                    var imageUrl = baseUrl + attrImageSource.value;
                    this.loading++;
                    if (isDiffuse)
                    {
                        this.materialParams[index].map = this._loadTexture(imageUrl, this.onTextureLoaded);
                    }
                    else
                    {
                        this.materialParams[index].specularMap = this._loadTexture(imageUrl, this.onTextureLoaded);
                    }
                }
            }
        }
    },

    /**
     * Parse light
     * @param node: content of .xaml file
     * @param group: current 3D group
     */
    _parseLight: function(node, group)
    {
        var separator = /[ ,]+/;
        var color = 0xFFFFFF;
        var direction = new THREE.Vector3(0, 0, 1);
        var position = new THREE.Vector3(0, 0, 0);

        if (node.nodeName == "SpotLight" || node.nodeName == "DirectionalLight")
        {
            var attrDirection = this._getAttributeByName(node, "Direction");
            if (attrDirection)
            {
                var strDirection = attrDirection.value;
                var result = strDirection.split(separator);
                direction.x = parseFloat(result[ 0 ]);
                direction.y = parseFloat(result[ 1 ]);
                direction.z = parseFloat(result[ 2 ]);
            }
        }

        var attrColor = this._getAttributeByName(node, "Color");
        if (attrColor)
        {
            color = attrColor.value;

            // Convert hexadecimal value (ex '#AABBCCDD' to '0xAABBCCDD')
            if (color[0] == '#')
            {
                if (color.length > 7)
                {
                    color = parseInt("0x" + color.slice(3, color.length));
                }
                else
                {
                    color = parseInt("0x" + color.slice(1, color.length));
                }
            }
        }

        if (node.nodeName == "SpotLight" || node.nodeName == "PointLight")
        {
            var attrPosition = this._getAttributeByName(node, "Position");
            if (attrPosition)
            {
                var strPosition = attrPosition.value;
                var result = strPosition.split(separator);
                position.x = parseFloat(result[ 0 ]);
                position.y = parseFloat(result[ 1 ]);
                position.z = parseFloat(result[ 2 ]);
            }
        }

        var light = null;

        if (node.nodeName == "SpotLight")
        {
            light = new THREE.SpotLight(color);
            light.position.set(position.x, position.y, position.z);
        }
        else if (node.nodeName == "DirectionalLight")
        {
            light = new THREE.DirectionalLight(color);
            light.position.set(direction.x, direction.y, direction.z);
        }
        else
        {
            light = new THREE.PointLight(color);
            light.position.set(position.x, position.y, position.z);
        }

        group.add(light);
    },

    /**
     * Parse camera
     * @param node: content of .xaml file
     */
    _parseCamera: function(node)
    {
        var separator = /[ ,]+/;
        var position = new THREE.Vector3(0, 0, 0);
        var look = new THREE.Vector3(0, 0, 1);
        var up = new THREE.Vector3(0, 1, 0);
        var fov = 60;

        var attrPosition = this._getAttributeByName(node, "Position");
        if (attrPosition)
        {
            var strPosition = attrPosition.value;
            var result = strPosition.split(separator);
            position.x = parseFloat(result[ 0 ]);
            position.y = parseFloat(result[ 1 ]);
            position.z = parseFloat(result[ 2 ]);
        }

        var attrUp = this._getAttributeByName(node, "UpDirection");
        if (attrUp)
        {
            var strUp = attrUp.value;
            var result = strUp.split(separator);
            up.x = parseFloat(result[ 0 ]);
            up.y = parseFloat(result[ 1 ]);
            up.z = parseFloat(result[ 2 ]);
        }

        var attrLook = this._getAttributeByName(node, "LookDirection");
        if (attrLook)
        {
            var strLook = attrLook.value;
            var result = strLook.split(separator);
            look.x = parseFloat(result[ 0 ]);
            look.y = parseFloat(result[ 1 ]);
            look.z = parseFloat(result[ 2 ]);
        }

        var attrFov = this._getAttributeByName(node, "FieldOfView");
        if (attrFov)
        {
            var strFov = attrFov.value;
            fov = parseFloat(strFov);
        }

        this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100000);
        this.camera.position.set(position.x, position.y, position.z);
        this.camera.up.set(up.x, up.y, up.z);
        this.camera.lookAt(look);
    },

    /**
     * Load the given texture
     * @param url: url of image file
     * @param onLoad: on load callback
     * @param onError: on error callback
     * @return created texture
     */
    _loadTexture: function (url, onLoad, onError)
    {
        var self = this;
        var texture;
        var loader = THREE.Loader.Handlers.get(url);

        if (loader !== null)
        {
            texture = loader.load(url, onLoad);
        }
        else
        {
            texture = new THREE.Texture();

            loader = new THREE.ImageLoader();
            loader.crossOrigin = this.crossOrigin;
            loader.load(url, function (image)
            {
                texture.image = self._ensurePowerOfTwo(image);
                texture.needsUpdate = true;

                if (onLoad) onLoad(texture);
            } );
        }

        return texture;
    },

    /**
     * Transform if needed the given image to "power of two" image
     * @param image: image file
     * @return new image
     */
    _ensurePowerOfTwo: function (image)
    {
        if (!THREE.Math.isPowerOfTwo(image.width) || !THREE.Math.isPowerOfTwo(image.height))
        {
            var canvas = document.createElement("canvas");
            canvas.width = this._nextHighestPowerOfTwo(image.width);
            canvas.height = this._nextHighestPowerOfTwo(image.height);

            var ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
            return canvas;
        }

        return image;
    },

    /**
     * Compute the next power of two of given value
     * @param x: value
     * @return next power of two
     */
    _nextHighestPowerOfTwo: function(x)
    {
        --x;
        for (var i = 1; i < 32; i <<= 1)
        {
            x = x | x >> i;
        }

        return x + 1;
    },

    /**
     * Search the attribute with the given name in given element
     * @param element: element to parse
     * @param name: attribute name
     * @return attribute
     */
    _getAttributeByName: function(element, name)
    {
        var attributeCount = element.attributes.length;
        for (var i = 0; i < attributeCount; i++)
        {
            if (element.attributes[i].name == name)
            {
                return element.attributes[i];
            }
        }
        return null;
    },

    /**
     * Search the child node with the given name in given element
     * @param element: element to parse
     * @param name: child node name
     * @param recursive: search recursively
     * @return child node
     */
    _getChildNodeByName: function(element, name, recursive)
    {
        var childNodeCount = element.childNodes.length;
        for (var i = 0; i < childNodeCount; i++)
        {
            var childNode = element.childNodes[i];
            if (childNode.nodeName == name)
            {
                return childNode;
            }
            else if (recursive)
            {
                var result = this._getChildNodeByName(childNode, name, recursive);
                if (result)
                {
                    return result;
                }
            }
        }
        return null;
    }
};