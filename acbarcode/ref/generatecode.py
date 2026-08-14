#!/usr/bin/env python3
"""
Sensor QR Code Generator for SUTO Flutter Apps

This tool generates QR codes for sensor registration that are compatible
with the SUTO Flutter app license control system.

Usage:
    python3 generatecode.py S4C-APP 12345678
    python3 generatecode.py WTU 87654321
"""

import hashlib
import qrcode
import sys
import argparse
import os
from pathlib import Path
from typing import Optional


class SensorQRGenerator:
    """Generator for sensor QR codes compatible with SUTO Flutter apps"""
    
    # Constants from license_control.dart
    SENSOR_SALT = 'this_is_sensor_salt'
    
    def __init__(self):
        self.qr_prefix = 'sensor'  # Based on the code logic
    
    def generate_sensor_qr(self, product_type: str, serial_number: str) -> str:
        """
        Generate a sensor QR code string
        
        Args:
            product_type: The product type (e.g., 'S4C-APP', 'WTU')
            serial_number: The sensor serial number
            
        Returns:
            The QR code string that can be encoded into a QR code
        """
        # Generate the MD5 hash as per the Dart implementation
        hash_input = f"{self.SENSOR_SALT}/{product_type}/{serial_number}"
        md5_hash = hashlib.md5(hash_input.encode('utf-8')).hexdigest()
        
        # Construct the QR code string (4 parts separated by '/')
        qr_content = f"/{self.qr_prefix}/{product_type}/{serial_number}/{md5_hash}"
        
        return qr_content
    
    def create_qr_image(self, qr_content: str, output_file: Optional[str] = None) -> qrcode.QRCode:
        """
        Create a QR code image
        
        Args:
            qr_content: The content to encode in the QR code
            output_file: Optional output file path (will be saved to output/ folder)
            
        Returns:
            QRCode object
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_content)
        qr.make(fit=True)
        
        if output_file:
            # Ensure output directory exists
            output_dir = Path('output')
            output_dir.mkdir(exist_ok=True)
            
            # If output_file is just a filename, save to output folder
            # If it's a full path, extract filename and save to output folder
            if os.path.dirname(output_file):
                # User provided a path, use just the filename
                filename = os.path.basename(output_file)
            else:
                # User provided just a filename
                filename = output_file
            
            # Save to output folder
            output_path = output_dir / filename
            img = qr.make_image(fill_color="black", back_color="white")
            img.save(output_path)
            print(f"QR code saved to: {output_path}")
        
        return qr
    
    def print_qr_info(self, product_type: str, serial_number: str, qr_content: str):
        """Print information about the generated QR code"""
        print(f"\n{'='*60}")
        print(f"SENSOR QR CODE GENERATED")
        print(f"{'='*60}")
        print(f"Product Type: {product_type}")
        print(f"Serial Number: {serial_number}")
        print(f"QR Content: {qr_content}")
        print(f"{'='*60}")
        
        # Show the expected sensor name format
        if ' ' in product_type:
            sensor_name = f"S {product_type[1:]}"
        else:
            sensor_name = product_type
        sensor_name = f"{sensor_name} - {serial_number}"
        print(f"Expected Sensor Name: {sensor_name}")
        print(f"{'='*60}\n")


def main():
    """Main function to handle command line arguments and generate QR codes"""
    parser = argparse.ArgumentParser(
        description="Generate sensor QR codes for SUTO Flutter apps",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 generatecode.py S4C-APP 12345678
  python3 generatecode.py WTU 87654321 --output sensor_qr.png
  python3 generatecode.py FM20 ABC12345 --output fm20_sensor.png
        """
    )
    
    parser.add_argument(
        'product_type',
        help='Product type (e.g., S4C-APP, WTU, FM20)'
    )
    
    parser.add_argument(
        'serial_number',
        help='Sensor serial number'
    )
    
    parser.add_argument(
        '--output', '-o',
        help='Output file path for QR code image (optional)'
    )
    
    parser.add_argument(
        '--text-only', '-t',
        action='store_true',
        help='Only print the QR code text without generating image'
    )
    
    args = parser.parse_args()
    
    # Validate inputs
    if not args.product_type or not args.serial_number:
        print("Error: Both product_type and serial_number are required")
        sys.exit(1)
    
    # Generate QR code
    generator = SensorQRGenerator()
    
    try:
        qr_content = generator.generate_sensor_qr(args.product_type, args.serial_number)
        
        # Print information
        generator.print_qr_info(args.product_type, args.serial_number, qr_content)
        
        # Generate QR code image if requested
        if not args.text_only:
            # Determine output filename
            if args.output:
                # If user provided a path, use just the filename
                output_filename = os.path.basename(args.output) if os.path.dirname(args.output) else args.output
            else:
                # Default filename
                output_filename = f"{args.product_type.lower()}_{args.serial_number}_qr.png"
            
            generator.create_qr_image(qr_content, output_filename)
            
            # Also print ASCII QR code to console
            qr = generator.create_qr_image(qr_content)
            print("ASCII QR Code:")
            qr.print_ascii(invert=True)
        
    except Exception as e:
        print(f"Error generating QR code: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
