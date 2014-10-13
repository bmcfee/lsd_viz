#!/usr/bin/env python

import numpy as np
import cPickle as pickle
import ujson as json
import os
import glob

#-- collection functions
def get_collections():
    track_count = len(glob.glob('data/*.json'))
    return [{'collection_id': 0, 
             'name': 'All',
             'track_count': track_count}]

def get_collection_info(collection_id):
    track_count = len(glob.glob('data/*.json'))
    return {'name': 'All', 'track_count': track_count}

def get_tracks(collection_id, offset=0, limit=10):

    # Maybe easier with just collection objects
    tracks = []
    for data in sorted(glob.glob('data/*.json'))[offset:offset+limit]:
        id = os.path.splitext(os.path.basename(data))[0]
        data_js = json.load(open(data, 'r'))
        tracks.append({'track_id':    int(id), 
                        'title':       data_js['title'], 
                        'artist':      data_js['artist']})

    return tracks


#-- track functions
def get_track_audio(track_id):
    
    track = json.load(open('data/%08d.json' % track_id))

    return track['filename']


def __get_track_lowlevel(track):

    if 'librosa:low-level' not in track.annotation_dict:
        return {}

    with open(track.annotation_dict['librosa:low-level'], 'r') as f:
        analysis = pickle.load(f)

    data = {}

    data['signal']      = analysis['signal'].tolist()
    data['tempo']       = analysis['tempo']
    data['tuning']      = analysis['tuning']
    data['duration']    = analysis['duration']

    return data

def __get_track_midlevel(track):
    
    if 'librosa:mid-level' not in track.annotation_dict:
        return {}

    with open(track.annotation_dict['librosa:mid-level'], 'r') as f:
        analysis = pickle.load(f)

    data = {}
    data['beats']       = analysis['beat_times'].tolist()
    data['links']       = analysis['mfcc_neighbors_beat'].tolist()
    data['segment_tree']= [z.tolist() for z in analysis['segment_beat_tree']]
    data['segments']    = analysis['segment_beat_tree'][analysis['segments_best']].tolist()
    data['cqt']         = (analysis['beat_sync_cqt'] ** (1./3)).T.tolist()
    data['chroma']      = np.roll(analysis['beat_sync_chroma'], -3, axis=0).T.tolist()

    return data

def get_track_analysis(track_id):

    analysis = json.load(open('data/%08d.json' % track_id))

    analysis['track_id'] = track_id

    return analysis
