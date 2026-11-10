from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Simulación de almacenamiento en memoria para el prototipo (luego se puede pasar a base de datos)
transmisiones_activas = [] # Guardará coordenadas, usuario y estado de la señal

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/transmitir')
def transmitir():
    return render_template('transmitir.html')

@app.route('/escuchar')
def escuchar():
    return render_template('escuchar.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)