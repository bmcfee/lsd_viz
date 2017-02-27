# -*- coding: utf-8 -*-
""" Laplacian segmentation """

# Code source: Brian McFee
# License: ISC

import numpy as np
import scipy

import sklearn.cluster

import librosa


BPO = 12 * 3
N_OCTAVES = 7
EVEC_SMOOTH = 9
REC_SMOOTH = 9
MAX_TYPES = 12
REC_WIDTH = 9


def make_beat_sync_features(y, sr):

    yh = librosa.effects.harmonic(y, margin=8)
    C = librosa.amplitude_to_db(librosa.cqt(y=yh, sr=sr,
                                            bins_per_octave=BPO,
                                            n_bins=N_OCTAVES * BPO),
                                ref=np.max)

    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, trim=False)
    Csync = librosa.util.sync(C, beats, aggregate=np.median)

    beat_times = librosa.frames_to_time(librosa.util.fix_frames(beats,
                                                                x_min=0,
                                                                x_max=C.shape[1]),
                                        sr=sr)

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    Msync = librosa.util.sync(mfcc, beats)

    return Csync, Msync, beat_times


def embed_beats(A_rep, A_loc):

    R = librosa.segment.recurrence_matrix(A_rep, width=REC_WIDTH,
                                          mode='affinity',
                                          metric='cosine',
                                          sym=True)

    # Enhance diagonals with a median filter (Equation 2)
    df = librosa.segment.timelag_filter(scipy.ndimage.median_filter)
    Rf = df(R, size=(1, REC_SMOOTH))

    path_distance = np.sum(np.diff(A_loc, axis=1)**2, axis=0)
    sigma = np.median(path_distance)
    path_sim = np.exp(-path_distance / sigma)

    R_path = np.diag(path_sim, k=1) + np.diag(path_sim, k=-1)

    ##########################################################
    # And compute the balanced combination (Equations 6, 7, 9)

    deg_path = np.sum(R_path, axis=1)
    deg_rec = np.sum(Rf, axis=1)

    mu = deg_path.dot(deg_path + deg_rec) / np.sum((deg_path + deg_rec)**2)

    A = mu * Rf + (1 - mu) * R_path

    #####################################################
    # Now let's compute the normalized Laplacian (Eq. 10)
    L = scipy.sparse.csgraph.laplacian(A, normed=True)

    # and its spectral decomposition
    evals, evecs = scipy.linalg.eigh(L)

    # We can clean this up further with a median filter.
    # This can help smooth over small discontinuities
    evecs = scipy.ndimage.median_filter(evecs, size=(EVEC_SMOOTH, 1))

    return evecs


def cluster(evecs, Cnorm, k, beat_times):
    X = evecs[:, :k] / Cnorm[:, k-1:k]

    KM = sklearn.cluster.KMeans(n_clusters=k)

    seg_ids = KM.fit_predict(X)

    ###############################################################
    # Locate segment boundaries from the label sequence
    bound_beats = 1 + np.flatnonzero(seg_ids[:-1] != seg_ids[1:])

    # Count beats 0 as a boundary
    bound_beats = librosa.util.fix_frames(bound_beats, x_min=0)

    # Compute the segment label for each boundary
    bound_segs = list(seg_ids[bound_beats])

    # Convert beat indices to frames
    bound_times = beat_times[bound_beats]

    # Tack on the end-time
    bound_times = list(np.append(bound_times, beat_times[-1]))

    ivals, labs = [], []
    for interval, label in zip(zip(bound_times, bound_times[1:]), bound_segs):
        ivals.append(interval)
        labs.append(str(label))

    return ivals, labs


def segment_file(filename):
    y, sr = librosa.load(filename)

    Csync, Msync, beat_times = make_beat_sync_features(y=y, sr=sr)

    embedding = embed_beats(Csync, Msync)

    Cnorm = np.cumsum(embedding**2, axis=1)**0.5

    segmentations = []
    for k in range(1, MAX_TYPES):
        segmentations.append(cluster(embedding, Cnorm, k, beat_times))

    return segmentations
