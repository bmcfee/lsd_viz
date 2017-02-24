#!/usr/bin/env python
'''Laplacian structural decomposition viewer'''

from argparse import ArgumentParser
import sys
import os
import re
import mimetypes

import flask
import json

import segmenter


def process_arguments(args):

    parser = ArgumentParser(description=__doc__)

    parser.add_argument('-p', '--port', dest='port',
                        default=9999, help='Port number',
                        type=int)

    parser.add_argument('--host', dest='host',
                        default='0.0.0.0', help='Host IP',
                        type=str)

    parser.add_argument(dest='filename', type=str,
                        help='Audio file input')

    return parser.parse_args(args)


app = flask.Flask(__name__)
app.config.from_object(__name__)


@app.route('/')
def index():
    '''The main page'''
    return flask.render_template('lsdviz.html',
                                 filename=params.filename,
                                 metadata=os.path.basename(params.filename))


def send_file_partial(path, **kwargs):
    """Simple wrapper around send_file which handles HTTP 206 Partial Content
       (byte ranges)
       TODO: handle all send_file args, mirror send_file's error handling
       (if it has any)"""
    range_header = flask.request.headers.get('Range', None)
    if not range_header:
        return flask.send_file(path, **kwargs)

    size = os.path.getsize(path)
    byte1, byte2 = 0, None

    m = re.search('(\d+)-(\d*)', range_header)
    g = m.groups()

    if g[0]:
        byte1 = int(g[0])

    if g[1]:
        byte2 = int(g[1])

    length = size - byte1
    if byte2 is not None:
        length = byte2 - byte1

    data = None
    with open(path, 'rb') as f:
        f.seek(byte1)
        data = f.read(length)

    rv = flask.Response(data,
                        206,
                        mimetype=mimetypes.guess_type(path)[0],
                        direct_passthrough=True)

    rv.headers.add('Content-Range',
                   'bytes {0}-{1}/{2}'.format(byte1,
                                              byte1 + length - 1,
                                              size))

    return rv


@app.route('/audio')
def get_audio():
    return send_file_partial(params.filename, cache_timeout=0)


@app.route('/analysis')
def get_analysis():
    return json.dumps(segment_hierarchy)


if __name__ == '__main__':
    params = process_arguments(sys.argv[1:])

    segment_hierarchy = segmenter.segment_file(params.filename)

    app.run(host=params.host, port=params.port, debug=True)
