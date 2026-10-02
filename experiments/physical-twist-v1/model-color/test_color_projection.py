"""Color is independent of the learned structural relation input."""
from pathlib import Path
import sys
import unittest

folder=Path(__file__).resolve().parent
sys.path.insert(0,str(folder.parents[2]/'experiments/scaffold-program-v1/model'))
from config import relation_query, without_color
from predict import clean_negation, extract_phrases
from color_cases import cases


class ColorProjectionTest(unittest.TestCase):
    def test_all_palette_forms_preserve_relation_inputs(self):
        for case in cases():
            with self.subTest(text=case['text']):
                self.assertEqual(relation_query(case['text']),relation_query(case['base']))

    def test_english_substrings_are_not_colors(self):
        for word in ['redwood','whiteboard','blueprint','greenhouse','pinkish']:
            with self.subTest(word=word):
                self.assertIn(word,relation_query(word+' above a cube'))

    def test_color_is_removed_from_relation_not_shape_words(self):
        self.assertEqual(relation_query('白い棒の先に球'),relation_query('棒の先に球'))
        self.assertNotEqual(relation_query('棒の先に球'),relation_query('棒の上に球'))

    def test_color_projection_preserves_scoped_alias_and_negation(self):
        cases=[
            ('赤い球ではなく青い箱','球ではなく箱'),
            ('白色球ではなく青色箱','球ではなく箱'),
            ('not a red sphere but a blue box','not a sphere but a box'),
            ('赤い棒は要らない。青い球だけ作る','棒は要らない。球だけ作る'),
            ('シアンの細い管の先端に、桃色の太い管を接続する','細い管の先端に、太い管を接続する'),
        ]
        for colored,plain in cases:
            with self.subTest(text=colored):
                cleaned=clean_negation(without_color(colored))[0]
                baseline=clean_negation(plain)[0]
                self.assertEqual(' '.join(cleaned.split()),' '.join(baseline.split()))
                phrases,pattern=extract_phrases(cleaned)
                base_phrases,base_pattern=extract_phrases(baseline)
                self.assertEqual(pattern,base_pattern)
                self.assertEqual([' '.join(value.split()) for value in phrases],[' '.join(value.split()) for value in base_phrases])


if __name__=='__main__':
    unittest.main()
