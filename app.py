from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return "Hello from Flask inside Docker!"

app.run(host="0.0.0.0", port=8080)


#test comment
