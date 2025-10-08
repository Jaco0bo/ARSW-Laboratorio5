var app = (function () {
    var _selectedAuthor = ""; // display name
    var _blueprintsSummary = []; // lista de {name, size}

    function _normalizeAuthorKey(name) {
        if (!name) return "";
        return name.trim().replace(/\s+/g, "").toLowerCase();
    }

    function _clearTable() {
        $("#blueprintsTable tbody").empty();
    }

    function _updateSelectedAuthorDisplay() {
        if (!_selectedAuthor) {
            $("#selectedAuthor").text("");
        } else {
            $("#selectedAuthor").text("Author: " + _selectedAuthor);
        }
    }

    function _updateTotalDisplay(total) {
        $("#totalPoints").text("Total points: " + total);
    }

    // transforma la respuesta original a { name, size } (primer map)
    function _toNameAndSize(list) {
        if (!Array.isArray(list)) return [];
        return list.map(function (bp) {
            return {
                name: bp.name || "",
                size: Array.isArray(bp.points) ? bp.points.length : 0
            };
        });
    }

    // Construye y añade filas a la tabla (ahora incluye botón "Draw")
    function _appendRowsFromSummary(summaryList) {
        var $tbody = $("#blueprintsTable tbody");
        $tbody.empty();

        summaryList.map(function (item, index) {
            var $tr = $("<tr>");
            $tr.append($("<td>").text(index + 1));
            $tr.append($("<td>").text(item.name));
            // mostrar el autor como el texto tal como fue ingresado por el usuario
            $tr.append($("<td>").text(_selectedAuthor || ""));
            $tr.append($("<td>").text(item.size));

            // botón Draw en la última columna
            var $actionTd = $("<td>");
            var $btn = $("<button>")
                .addClass("btn btn-sm btn-outline-primary")
                .text("Draw");
            // asociar evento: llama a app.drawBlueprint con (displayAuthor, blueprintName)
            $btn.on("click", function (e) {
                e.preventDefault();
                // Llamar a la operación pública drawBlueprint
                // (la función pública se expone en el return al final)
                // usamos _selectedAuthor (display) y item.name
                app.drawBlueprint(_selectedAuthor, item.name);
            });
            $actionTd.append($btn);
            $tr.append($actionTd);

            $tbody.append($tr);
            return $tr;
        });
    }

    // Permite cambiar el nombre del autor actualmente seleccionado
    function setSelectedAuthor(displayName) {
        _selectedAuthor = displayName || "";
        _updateSelectedAuthorDisplay();
    }

    // Actualiza el listado de planos a partir del nombre del autor
    function updateBlueprintsForAuthor(authorDisplayName) {
        setSelectedAuthor(authorDisplayName);
        var key = _normalizeAuthorKey(authorDisplayName);
        if (!key) {
            _blueprintsSummary = [];
            _clearTable();
            _updateTotalDisplay(0);
            return;
        }

        // Invocar apimock
        apimock.getBlueprintsByAuthor(key, function (blueprintsList) {
            var originalList = Array.isArray(blueprintsList) ? blueprintsList : [];
            var nameSizeList = _toNameAndSize(originalList);

            // Guardar en estado privado
            _blueprintsSummary = nameSizeList;
            _appendRowsFromSummary(nameSizeList);

            // Reduce para calcular total
            var total = nameSizeList.reduce(function (acc, el) {
                return acc + (el.size || 0);
            }, 0);

            // Actualizar DOM con total
            _updateTotalDisplay(total);

            if (nameSizeList.length === 0) {
                $("#selectedAuthor").append(" — no blueprints found.");
            }
        });
    }

    // DIBUJAR: obtiene blueprint por nombre+autor y lo dibuja en canvas
    function drawBlueprint(authorDisplayName, blueprintName) {
        if (!blueprintName) {
            alert("Blueprint name required.");
            return;
        }

        var key = _normalizeAuthorKey(authorDisplayName);
        if (!key) {
            alert("Author required to draw the blueprint.");
            return;
        }

        // solicitar blueprint específico al mock
        apimock.getBlueprintsByNameAndAuthor(key, blueprintName, function (bp) {
            if (!bp) {
                alert("Blueprint not found for author: " + authorDisplayName);
                return;
            }

            var points = Array.isArray(bp.points) ? bp.points : [];

            // asegurarse de que el elemento que muestra el nombre exista:
            if ($("#currentBlueprintName").length === 0) {
                // lo insertamos justo después del selectedAuthor
                $("<div id='currentBlueprintName' class='mb-2 fw-medium'></div>").insertAfter("#selectedAuthor");
            }
            $("#currentBlueprintName").text("Drawing: " + blueprintName);

            // obtener canvas y contexto
            var canvas = document.getElementById("blueprintCanvas");
            if (!canvas) {
                alert("Canvas element not found.");
                return;
            }
            var ctx = canvas.getContext("2d");
            var cw = canvas.width;
            var ch = canvas.height;

            // limpiar canvas
            ctx.clearRect(0, 0, cw, ch);

            if (points.length === 0) {
                // nada que dibujar
                ctx.font = "14px Arial";
                ctx.fillText("No points available for this blueprint.", 10, 20);
                return;
            }

            // --- mapear puntos al espacio del canvas (fit with padding) ---
            var padding = 20;
            var xs = points.map(function(p){ return p.x; });
            var ys = points.map(function(p){ return p.y; });
            var minX = Math.min.apply(null, xs);
            var maxX = Math.max.apply(null, xs);
            var minY = Math.min.apply(null, ys);
            var maxY = Math.max.apply(null, ys);

            var dataW = (maxX - minX) || 1;
            var dataH = (maxY - minY) || 1;

            var scaleX = (cw - 2*padding) / dataW;
            var scaleY = (ch - 2*padding) / dataH;
            var scale = Math.min(scaleX, scaleY);

            // función para convertir punto de datos a coordenada de canvas
            function mapPoint(p) {
                var x = (p.x - minX) * scale + padding;
                // invertir Y para que el 0,0 de datos quede visualmente arriba como en datos cartesian y canvas y sea consistente
                var y = (maxY - p.y) * scale + padding; // flip y para que mayor y sea más arriba
                return { x: x, y: y };
            }

            // dibujar líneas
            ctx.beginPath();
            var p0 = mapPoint(points[0]);
            ctx.moveTo(p0.x, p0.y);
            for (var i = 1; i < points.length; i++) {
                var mp = mapPoint(points[i]);
                ctx.lineTo(mp.x, mp.y);
            }
            ctx.strokeStyle = "#007bff";
            ctx.lineWidth = 2;
            ctx.stroke();

            // dibujar pequeños círculos en cada punto
            for (var j = 0; j < points.length; j++) {
                var mp2 = mapPoint(points[j]);
                ctx.beginPath();
                ctx.arc(mp2.x, mp2.y, 3, 0, Math.PI*2);
                ctx.fillStyle = "#ff5722";
                ctx.fill();
            }
        });
    }

    // Inicialización
    function init() {
        $("#getBlueprintsBtn").on("click", function (e) {
            e.preventDefault();
            var inputVal = $("#authorInput").val();
            updateBlueprintsForAuthor(inputVal);
        });

        // Permitir Enter en el input
        $("#authorInput").on("keypress", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                var inputVal = $("#authorInput").val();
                updateBlueprintsForAuthor(inputVal);
            }
        });

        _selectedAuthor = "";
        _blueprintsSummary = [];
        _clearTable();
        _updateTotalDisplay(0);
        _updateSelectedAuthorDisplay();

        // limpiar canvas al iniciar (si existe)
        var canvas = document.getElementById("blueprintCanvas");
        if (canvas && canvas.getContext) {
            var ctx = canvas.getContext("2d");
            ctx.clearRect(0,0,canvas.width,canvas.height);
        }
    }

    // Exponer API pública (incluye la nueva drawBlueprint)
    return {
        init: init,
        setSelectedAuthor: setSelectedAuthor,
        updateBlueprintsForAuthor: updateBlueprintsForAuthor,
        drawBlueprint: drawBlueprint
    };
})();


